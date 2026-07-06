#import "VoidGuard.h"
#import <objc/runtime.h>
#import <stdatomic.h>

// ─────────────────────────────────────────────────────────────────────────────
// VoidGuard — iOS New-Architecture "void TurboModule throws at boot" crash fix.
//
// THE CRASH
//   React Native's ObjCTurboModule::performVoidMethodInvocation runs a native
//   module's void method via `[inv invokeWithTarget:module]`. If that ObjC call
//   throws an NSException, RN's @catch calls convertNSExceptionToJSError(...),
//   which mutates the Hermes JS runtime. Under the New Architecture that @catch
//   can run on a BACKGROUND dispatch queue (off the JS thread), so touching
//   Hermes there races the JS thread → heap corruption → EXC_BAD_ACCESS (SIGSEGV)
//   during app launch, before the first screen renders. A JS try/catch cannot
//   catch it (the throw is native and off-thread).
//
// WHY THIS (a swizzle) INSTEAD OF PATCHING RN SOURCE
//   The proper fix patches RCTTurboModule.mm to not rethrow. But that source
//   file is compiled into React.framework, which on this app is a PREBUILT
//   binary (buildReactNativeFromSource:false) — the only config in which the JS
//   engine actually runs here. A prebuilt binary cannot be source-patched. So we
//   intercept one level lower, at -[NSInvocation invokeWithTarget:], catching the
//   NSException BEFORE RN's own @catch (and thus before convertNSExceptionToJSError)
//   ever runs. A void method has no return value to satisfy, so suppress + log.
//
// DIAGNOSTIC SELF-REPORTING (TEMPORARY)
//   Suppressing the crash left the app on a dead-runtime navy screen with no way
//   to see WHICH native module threw (the user has no Mac to read device logs).
//   So each suppressed NSException is now ALSO (a) persisted to NSUserDefaults
//   (read + uploaded by the JS boot prelude on a later launch) and (b) POSTed
//   asynchronously to our crash-reports endpoint. This is capped, reentrancy-
//   guarded, and never blocks the boot thread. Remove once the culprit module is
//   identified and fixed precisely.
//
// SCOPE / TRADEOFF
//   Swizzling NSInvocation is process-wide, but behaviour only changes when an
//   NSException is actually thrown through invokeWithTarget: (otherwise we call
//   straight through). The accepted tradeoff: a non-void TurboModule method that
//   throws would also be swallowed (JS would see undefined instead of an error).
// ─────────────────────────────────────────────────────────────────────────────

static NSString *const kVoidGuardReportsKey = @"IBVoidGuardReports";
static const int kVoidGuardMaxReports = 5;

static void (*ib_orig_invokeWithTarget)(id, SEL, id) = NULL;

// Total remote reports sent this process (capped). Atomic: the guard runs on
// arbitrary threads.
static atomic_int ib_report_count = 0;
// Per-thread reentrancy guard: if the reporting path itself ever throws through
// invokeWithTarget:, we must not recurse into reporting again.
static __thread BOOL ib_in_report = NO;

static NSString *ib_trunc(NSString *s, NSUInteger max) {
  if (s == nil) return @"";
  return (s.length <= max) ? s : [s substringToIndex:max];
}

static void ib_persist_report(NSString *jsonString) {
  @try {
    NSUserDefaults *d = [NSUserDefaults standardUserDefaults];
    NSArray *existing = [d stringArrayForKey:kVoidGuardReportsKey] ?: @[];
    NSMutableArray *arr = [existing mutableCopy];
    [arr addObject:jsonString];
    // Keep only the last 10 so this can never grow unbounded.
    if (arr.count > 10) {
      arr = [[arr subarrayWithRange:NSMakeRange(arr.count - 10, 10)] mutableCopy];
    }
    [d setObject:arr forKey:kVoidGuardReportsKey];
  } @catch (__unused NSException *e) {
    // best-effort — never let persistence throw
  }
}

static void ib_report_exception(NSException *exception, id target, int seq) {
  NSString *name = exception.name ?: @"(nil)";
  NSString *reason = exception.reason ?: @"(nil)";
  NSString *targetClass = target ? NSStringFromClass([target class]) : @"(nil)";

  NSArray<NSString *> *symbols = exception.callStackSymbols ?: @[];
  NSUInteger n = MIN((NSUInteger)15, symbols.count);
  NSString *stack =
      n > 0 ? [[symbols subarrayWithRange:NSMakeRange(0, n)] componentsJoinedByString:@"\n"]
            : @"";

  // Server enforces type ∈ {js_error,render_error,unhandled_rejection}; use
  // js_error with a clear prefix so the native reports are identifiable.
  NSString *message =
      ib_trunc([NSString stringWithFormat:@"[VoidGuard-native] seq=%d target=%@ name=%@ reason=%@",
                                          seq, targetClass, name, reason],
               2000);
  stack = ib_trunc(stack, 10000);

  NSBundle *b = [NSBundle mainBundle];
  NSString *appVersion = [b objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"unknown";
  NSString *buildVersion = [b objectForInfoDictionaryKey:@"CFBundleVersion"] ?: @"unknown";

  NSDictionary *payload = @{
    @"type" : @"js_error",
    @"message" : message,
    @"stack" : stack,
    @"app_version" : appVersion,
    @"build_version" : buildVersion,
    @"device_info" : @{@"platform" : @"ios", @"source" : @"VoidGuard-native"},
  };

  NSError *jsonErr = nil;
  NSData *body = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&jsonErr];
  if (body == nil) return;

  // Persist first (survives offline / process exit) so the JS prelude can upload
  // it on a later launch even if the POST below never flushes.
  NSString *jsonStr = [[NSString alloc] initWithData:body encoding:NSUTF8StringEncoding];
  if (jsonStr != nil) ib_persist_report(jsonStr);

  // Async POST — MUST NOT block the boot/turbomodule thread.
  NSURL *url = [NSURL URLWithString:@"https://www.ibhub.com.br/api/crash-reports"];
  if (url == nil) return;
  NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
  req.HTTPMethod = @"POST";
  [req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  req.HTTPBody = body;
  req.timeoutInterval = 10.0;
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:req
        completionHandler:^(NSData *_Nullable data, NSURLResponse *_Nullable response,
                            NSError *_Nullable error) {
          // best-effort; result intentionally ignored
        }];
  [task resume];
}

static void ib_guarded_invokeWithTarget(id self, SEL _cmd, id target) {
  @try {
    if (ib_orig_invokeWithTarget != NULL) {
      ib_orig_invokeWithTarget(self, _cmd, target);
    }
  } @catch (NSException *exception) {
    NSLog(@"[VoidGuard] Suppressed NSException in invokeWithTarget: "
          @"name=%@ reason=%@ target=%@\n%@",
          exception.name, exception.reason,
          target ? NSStringFromClass([target class]) : @"(nil)",
          exception.callStackSymbols);

    // Diagnostic report — capped, reentrancy-guarded, async.
    if (!ib_in_report) {
      int seq = atomic_fetch_add(&ib_report_count, 1);
      if (seq < kVoidGuardMaxReports) {
        ib_in_report = YES;
        @try {
          ib_report_exception(exception, target, seq);
        } @catch (__unused NSException *inner) {
          // never let reporting throw back through the guard
        }
        ib_in_report = NO;
      }
    }
  }
}

@implementation IBVoidGuard

+ (void)load {
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    Method m = class_getInstanceMethod([NSInvocation class], @selector(invokeWithTarget:));
    if (m == NULL) {
      NSLog(@"[VoidGuard] invokeWithTarget: not found — guard NOT installed");
      return;
    }
    ib_orig_invokeWithTarget = (void (*)(id, SEL, id))method_getImplementation(m);
    method_setImplementation(m, (IMP)ib_guarded_invokeWithTarget);
    NSLog(@"[VoidGuard] installed -[NSInvocation invokeWithTarget:] guard");
  });
}

@end
