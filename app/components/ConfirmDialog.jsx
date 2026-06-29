"use client"

export default function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, loading = false, error, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <p className="text-text-primary text-lg font-bold">{title}</p>
                <p className="text-text-secondary text-sm mt-2 leading-relaxed">{message}</p>

                {error && (
                    <p className="text-negative text-sm mt-3">{error}</p>
                )}

                <div className="flex gap-2.5 mt-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 border border-line rounded-lg py-2.5 text-sm text-text-secondary active:bg-background active:scale-95 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white active:scale-95 transition-all disabled:opacity-50 ${
                            danger ? "bg-negative hover:bg-negative/90" : "bg-accent text-black hover:text-white"
                        }`}
                    >
                        {loading ? "Please wait..." : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
