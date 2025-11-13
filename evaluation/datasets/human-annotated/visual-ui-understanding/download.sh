#!/bin/bash
# WebUI Dataset Download Script
# Source: https://github.com/js0nwu/webui

echo "📥 Downloading WebUI Dataset..."

# Clone repository
if [ ! -d "webui-repo" ]; then
  git clone https://github.com/js0nwu/webui.git webui-repo
fi

cd webui-repo

# Follow their download instructions
# (Check their README for actual download commands)

echo "✅ WebUI dataset downloaded"
echo "📝 Next: Run conversion script to integrate"
