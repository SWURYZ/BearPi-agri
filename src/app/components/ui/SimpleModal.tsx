type SimpleModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SimpleModal({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  hideCancel = false,
  onConfirm,
  onCancel,
}: SimpleModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        {description && <p className="mt-2 text-sm text-gray-500 leading-relaxed">{description}</p>}

        <div className="mt-5 flex justify-end gap-2">
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
