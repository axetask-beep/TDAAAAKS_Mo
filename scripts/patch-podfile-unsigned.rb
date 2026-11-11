# Run after `expo prebuild --platform ios`, before `pod install`.
#
# Passing CODE_SIGNING_ALLOWED=NO to xcodebuild on the command line only
# covers the app target. Every CocoaPods target (React Native core, Hermes,
# every third-party pod) keeps its own build settings and still demands a
# signing identity when building for a real device (-sdk iphoneos), which is
# the classic cause of "xcodebuild: Command failed with exit code 65" on this
# kind of unsigned/fakesigned build. This appends a loop to the generated
# Podfile's existing post_install hook that forces signing off on every pod
# target too.
#
# Anchored on Expo's current template output for the post_install block, so
# if a future SDK upgrade changes that template, this fails loudly (and
# prints the actual file) instead of silently doing nothing.
podfile_path = File.join(__dir__, '..', 'ios', 'Podfile')
content = File.read(podfile_path)

anchor = ":ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end"

unless content.include?(anchor)
  warn "patch-podfile-unsigned.rb: could not find the expected post_install anchor in #{podfile_path}."
  warn '--- Podfile content ---'
  warn content
  exit 1
end

patch = <<~RUBY

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        build_config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
        build_config.build_settings['CODE_SIGN_IDENTITY'] = ''
        build_config.build_settings['CODE_SIGN_ENTITLEMENTS'] = ''
        build_config.build_settings['DEVELOPMENT_TEAM'] = ''
      end
    end
  end
RUBY

replacement = ":ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n#{patch.chomp}"
File.write(podfile_path, content.sub(anchor, replacement))

puts 'Podfile patched: code signing disabled on all pod targets.'
