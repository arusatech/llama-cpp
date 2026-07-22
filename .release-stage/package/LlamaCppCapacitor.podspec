require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'LlamaCppCapacitor'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = package['repository']['url']
  s.author = package['author']
  s.source = { :git => package['repository']['url'], :tag => s.version.to_s }
  
  # Swift implementation
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
  
  # Include the pre-built native llama-cpp framework
  # Built with: ./build-variants.sh --variant minimal (or core/development)
  # Framework includes arm64 architecture with debug symbols stripped
  # For building locally, see BUILD_GUIDE.md
  s.vendored_frameworks = 'ios/Frameworks/llama-cpp.framework'
  s.pod_target_xcconfig = {
    'FRAMEWORK_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/ios/Frameworks"'
  }
  
  # Required for proper framework linking
  s.user_target_xcconfig = {
    'FRAMEWORK_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/ios/Frameworks"'
  }
end
