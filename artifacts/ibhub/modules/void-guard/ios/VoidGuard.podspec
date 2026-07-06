Pod::Spec.new do |s|
  s.name           = 'VoidGuard'
  s.version        = '1.0.0'
  s.summary        = 'iOS void-TurboModule NSException guard'
  s.description    = 'Swizzles -[NSInvocation invokeWithTarget:] to suppress + log NSExceptions thrown by void TurboModule methods at boot, preventing off-thread Hermes corruption (EXC_BAD_ACCESS) on the New Architecture with a prebuilt React core.'
  s.author         = 'ibhub'
  s.homepage       = 'https://www.ibhub.com.br'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
