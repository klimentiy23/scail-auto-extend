// Inline video preview for SCAILSaveSelectedVideo.
// ComfyUI's core SaveVideo preview uses the new Comfy API, while this portable
// install also has VideoHelperSuite-style preview widgets. This extension adds a
// real <video> player directly to the SCAIL final/preview output node and uses
// the files returned by the Python node in ui.gifs / ui.videos.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function viewURL(info) {
    const params = new URLSearchParams();
    params.set("filename", info.filename || "");
    params.set("type", info.type || "output");
    params.set("subfolder", info.subfolder || "");
    params.set("timestamp", Date.now().toString());
    return api.apiURL("/view?" + params.toString());
}

function pickVideoInfo(message) {
    if (message?.gifs?.[0]) return message.gifs[0];
    if (message?.videos?.[0]) return message.videos[0];
    if (Array.isArray(message?.video) && message.video.length >= 1) {
        return { filename: message.video[0], subfolder: message.video[1] || "", type: "output", format: "video/mp4" };
    }
    return null;
}

function setupNode(node) {
    const container = document.createElement("div");
    container.style.cssText = "width:100%;display:flex;flex-direction:column;gap:4px;";

    const label = document.createElement("div");
    label.textContent = "После запуска здесь появится просмотр финального/preview MP4";
    label.style.cssText = "font-size:11px;color:#aaa;line-height:14px;";
    container.appendChild(label);

    const video = document.createElement("video");
    video.controls = true;
    video.loop = false;
    video.muted = false;
    video.playsInline = true;
    video.style.cssText = "width:100%;max-height:520px;border-radius:6px;background:#111;display:none;";
    container.appendChild(video);

    const widget = node.addDOMWidget("scail_video_preview", "preview", container, {
        serialize: false,
        hideOnZoom: false,
    });
    widget.computeSize = function(width) {
        if (video.style.display === "none") return [width, 38];
        const ratio = video.videoWidth && video.videoHeight ? (video.videoHeight / video.videoWidth) : 16 / 9;
        const height = Math.min(560, Math.max(180, (node.size[0] - 20) * ratio + 34));
        return [width, height];
    };

    video.addEventListener("loadedmetadata", () => {
        node.setSize([Math.max(node.size[0], 460), Math.max(node.size[1], widget.computeSize(node.size[0])[1] + 170)]);
        node.graph?.setDirtyCanvas(true, true);
    });
    video.addEventListener("error", () => {
        label.textContent = "Файл сохранён, но браузер не смог открыть preview. Открой MP4 из папки output.";
        label.style.color = "#f88";
    });

    node._scailShowVideo = (message) => {
        const info = pickVideoInfo(message);
        if (!info?.filename) return;
        label.textContent = `${info.filename} — ${info.type || "output"}/${info.subfolder || ""}`;
        label.style.color = "#9f9";
        video.src = viewURL(info);
        video.style.display = "block";
        node.setSize([Math.max(node.size[0], 520), Math.max(node.size[1], 520)]);
        node.graph?.setDirtyCanvas(true, true);
    };
}

app.registerExtension({
    name: "scail.outputVideoPreview",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "SCAILSaveSelectedVideo") return;

        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const r = onCreated?.apply(this, arguments);
            setupNode(this);
            return r;
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function(message) {
            onExecuted?.apply(this, arguments);
            this._scailShowVideo?.(message);
        };
    },
});
