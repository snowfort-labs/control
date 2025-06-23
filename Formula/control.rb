# Homebrew Formula for Control
class Control < Formula
  desc "Self-hosted agent observability dashboard"
  homepage "https://github.com/snowfort-labs/control"
  version "0.1.0"
  
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/snowfort-labs/control/releases/download/v#{version}/control-v#{version}-darwin-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # Will be updated by CI
    else
      url "https://github.com/snowfort-labs/control/releases/download/v#{version}/control-v#{version}-darwin-amd64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # Will be updated by CI
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/snowfort-labs/control/releases/download/v#{version}/control-v#{version}-linux-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # Will be updated by CI
    else
      url "https://github.com/snowfort-labs/control/releases/download/v#{version}/control-v#{version}-linux-amd64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # Will be updated by CI
    end
  end

  def install
    if OS.mac?
      if Hardware::CPU.arm?
        bin.install "control-darwin-arm64" => "control"
      else
        bin.install "control-darwin-amd64" => "control"
      end
    else
      if Hardware::CPU.arm?
        bin.install "control-linux-arm64" => "control"
      else
        bin.install "control-linux-amd64" => "control"
      end
    end
  end

  test do
    # Test that the binary runs and shows help
    assert_match "Agent observability dashboard", shell_output("#{bin}/control --help")
    
    # Test version command
    assert_match version.to_s, shell_output("#{bin}/control --version 2>&1", 0)
    
    # Test badge generation (should work without data)
    output = shell_output("#{bin}/control badge 2>&1", 0)
    assert_match "Stability", output
    assert_match "img.shields.io", output
  end

  service do
    run [opt_bin/"control", "dashboard"]
    keep_alive false
    log_path var/"log/control.log"
    error_log_path var/"log/control.log"
    environment_variables PATH: std_service_path_env
  end
end