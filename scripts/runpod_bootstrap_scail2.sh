#!/usr/bin/env bash
set -Eeuo pipefail

COMFY_DIR="${COMFY_DIR:-/workspace/ComfyUI}"
CUSTOM_NODES="$COMFY_DIR/custom_nodes"
WORKFLOW_SRC_URL="https://raw.githubusercontent.com/klimentiy23/scail-auto-extend/fix/full-length-auto-extend/workflows/video_wan21_scail2_character_replacement_v34_lowvram_stream_autoprompt_autoextend.json"

mkdir -p "$CUSTOM_NODES" "$COMFY_DIR/user/default/workflows"
cd "$CUSTOM_NODES"

clone_or_update() {
  local url="$1" dir="$2" branch="${3:-}"
  if [ -d "$dir/.git" ]; then
    git -C "$dir" fetch --all --depth 1 || true
    if [ -n "$branch" ]; then git -C "$dir" checkout "$branch" || true; fi
    git -C "$dir" pull --ff-only || true
  else
    if [ -n "$branch" ]; then
      git clone --depth 1 --branch "$branch" "$url" "$dir"
    else
      git clone --depth 1 "$url" "$dir"
    fi
  fi
}

# Required by the fixed SCAIL2 workflow
clone_or_update https://github.com/klimentiy23/scail-auto-extend.git scail-auto-extend fix/full-length-auto-extend
clone_or_update https://github.com/GeekatplayStudio/wan-scail2-gap.git ComfyUI_gap_character_replacement
clone_or_update https://github.com/klimentiy23/scail-auto-prompt-builder.git scail_auto_prompt_builder
clone_or_update https://github.com/pythongosssss/ComfyUI-Custom-Scripts.git ComfyUI-Custom-Scripts
clone_or_update https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git ComfyUI-VideoHelperSuite
clone_or_update https://github.com/kijai/ComfyUI-KJNodes.git ComfyUI-KJNodes
clone_or_update https://github.com/rgthree/rgthree-comfy.git rgthree-comfy
clone_or_update https://github.com/justUmen/Bjornulf_custom_nodes.git Bjornulf_custom_nodes

# Patch Bjornulf audio save on RunPod too: avoid TorchCodec dependency by using local fixed file if present.
# The scail workflow can still run without this patch until audio mux, but patching prevents the known torchaudio.save failure.
if [ -f "$CUSTOM_NODES/scail-auto-extend/patches/ffmpeg_combine_video_audio.py" ]; then
  cp "$CUSTOM_NODES/scail-auto-extend/patches/ffmpeg_combine_video_audio.py" "$CUSTOM_NODES/Bjornulf_custom_nodes/ffmpeg_combine_video_audio.py"
fi

# Install custom-node Python deps when requirements exist.
for req in "$CUSTOM_NODES"/*/requirements.txt; do
  [ -f "$req" ] && python -m pip install -r "$req" || true
done

curl -L "$WORKFLOW_SRC_URL" -o "$COMFY_DIR/user/default/workflows/video_wan21_scail2_character_replacement_v34_lowvram_stream_autoprompt_autoextend.json"

# Start ComfyUI. Most RunPod ComfyUI templates use /workspace/ComfyUI.
cd "$COMFY_DIR"
exec python main.py --listen 0.0.0.0 --port 8188
