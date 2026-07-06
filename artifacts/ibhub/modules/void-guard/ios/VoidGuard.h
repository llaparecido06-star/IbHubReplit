#import <Foundation/Foundation.h>

// See VoidGuard.m for the full rationale. This class installs, via `+load`, a
// process-wide guard around -[NSInvocation invokeWithTarget:].
@interface IBVoidGuard : NSObject
@end
