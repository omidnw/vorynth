# typed: strict
# frozen_string_literal: true

# Homebrew Cask for Vorynth (v1.8.0)
#
# Source of truth for distribution via Homebrew. Two supported homes:
#
#   1. Personal tap (recommended while macOS builds aren't Developer-ID
#      notarized): keep this file in `omidnw/homebrew-vorynth` → `Casks/`,
#      users run `brew tap omidnw/vorynth && brew install --cask vorynth`.
#      Homebrew strips the quarantine attribute on install, so the ad-hoc
#      signed app opens without any Gatekeeper prompt.
#
#   2. Official homebrew-cask repo: PR this file to homebrew/homebrew-cask
#      once the release meets their bar (stable versioned URL, livecheck,
#      passing `brew audit --cask`). Their bump bot then auto-updates the
#      version + sha256 on every new release.
#
# NOTE: `auto_updates true` because Vorynth self-updates via its signed
# in-app updater (tauri-plugin-updater) — Homebrew won't nag about versions
# the app handles itself.
#
# When bumping: get the real checksum from the GitHub release API, e.g.
#   gh api repos/omidnw/vorynth/releases/latest --jq \
#     '.assets[] | select(.name | endswith("_aarch64.dmg")) | .digest'
cask "vorynth" do
  version "1.7.0"
  sha256 arm: "337e88ea94f241adb6ceb3a0dc45db643a2b6574215e4543e5dc9a875d1e9761"

  url "https://github.com/omidnw/vorynth/releases/download/v#{version}/Vorynth_#{version}_aarch64.dmg",
      verified: "github.com/omidnw/vorynth/"
  name "Vorynth"
  desc "Local-first personal intelligence engine"
  homepage "https://omidnw.github.io/vorynth/"

  # Lets Homebrew's bump bot (official repo) and `brew bump-cask-pr` track the
  # latest GitHub release for the version + sha256.
  livecheck do
    url "https://github.com/omidnw/vorynth/releases"
    strategy :github_latest
  end

  auto_updates true

  app "Vorynth.app"

  zap trash: "~/Library/Application Support/com.vorynth.desktop"
end
