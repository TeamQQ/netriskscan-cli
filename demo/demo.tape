# Regenerate this recording with either:
#   1. GitHub Actions -> run the "Demo GIF" workflow (.github/workflows/demo.yml)
#      manually and download the netriskscan-demo artifact.
#   2. Locally with VHS (https://github.com/charmbracelet/vhs) and Node.js on PATH:
#        vhs demo/demo.tape
#      The official ghcr.io/charmbracelet/vhs Docker image does not bundle Node.js,
#      so `npx netriskscan-cli` won't resolve inside a plain container - either run
#      vhs on a machine with Node >= 20 installed, or build a local image that adds
#      it (FROM ghcr.io/charmbracelet/vhs; RUN apt-get update && apt-get install -y
#      nodejs npm).
Output netriskscan-demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 700
Set Height 1000
Set Padding 20
Set TypingSpeed 60ms
Set Framerate 30

# Warm the npx cache so the recorded run resolves and starts instantly - this
# hides package-download time, not real NetRiskScan API latency.
Hide
Type "npx --yes netriskscan-cli check 1.1.1.1 > /dev/null 2>&1"
Enter
Sleep 8s
Type "clear"
Enter
Show

Sleep 800ms
Type "npx netriskscan-cli check 17.241.200.160"
Sleep 600ms
Enter
Sleep 8s
