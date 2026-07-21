"use client"
import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import { X, Image as ImageIcon } from "lucide-react"

// Renders the cropped area of an <img> onto a canvas and resolves a Blob —
// standard react-easy-crop recipe (there's no built-in "give me the pixels"
// API, just crop-box coordinates).
async function getCroppedBlob(imageSrc, cropPixels, mimeType) {
    const image = await new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = imageSrc
    })

    const canvas = document.createElement("canvas")
    canvas.width = cropPixels.width
    canvas.height = cropPixels.height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(
        image,
        cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
        0, 0, cropPixels.width, cropPixels.height
    )

    return new Promise((resolve) => canvas.toBlob(resolve, mimeType, 0.92))
}

// Shared reposition/zoom editor for avatar (round, 1:1) and banner (rect,
// wide) uploads — mirrors Discord's "Edit Image" dialog (drag to reposition,
// slider to zoom). GIFs bypass this entirely (see callers): canvas cropping
// would flatten them to a single frame, so animated uploads go straight
// through unmodified.
export default function ImageCropModal({ file, shape = "round", aspect = 1, onCancel, onCropped }) {
    const [imageSrc] = useState(() => URL.createObjectURL(file))
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedPixels, setCroppedPixels] = useState(null)
    const [saving, setSaving] = useState(false)

    const onCropComplete = useCallback((_, pixels) => setCroppedPixels(pixels), [])

    async function handleApply() {
        if (!croppedPixels) return
        setSaving(true)
        const blob = await getCroppedBlob(imageSrc, croppedPixels, file.type === "image/png" ? "image/png" : "image/jpeg")
        setSaving(false)
        onCropped(blob)
    }

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
            <div className="bg-surface border border-hairline rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <p className="text-text-primary text-lg font-medium">Edit image</p>
                    <button type="button" onClick={onCancel} className="text-text-secondary hover:text-text-primary active:scale-90 transition-transform"><X size={18} /></button>
                </div>

                <div className="relative w-full bg-background rounded-lg overflow-hidden" style={{ height: 320 }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        cropShape={shape}
                        showGrid={shape === "rect"}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                    />
                </div>

                <div className="flex items-center gap-3 mt-4">
                    <ImageIcon size={14} className="text-text-secondary flex-shrink-0" />
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 accent-accent"
                    />
                    <ImageIcon size={20} className="text-text-secondary flex-shrink-0" />
                </div>

                <div className="flex gap-2.5 mt-5">
                    <button type="button" onClick={onCancel} className="flex-1 border border-hairline rounded-lg py-2.5 text-sm text-text-secondary hover:border-accent/40 hover:text-text-primary active:bg-background active:scale-95 transition-all">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={saving || !croppedPixels}
                        className="flex-1 bg-accent rounded-lg py-2.5 text-sm text-black font-semibold hover:text-white disabled:opacity-40 disabled:hover:text-black active:scale-95 transition-all"
                    >
                        {saving ? "Saving..." : "Apply"}
                    </button>
                </div>
            </div>
        </div>
    )
}
