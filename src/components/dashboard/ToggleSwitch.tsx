export function ToggleSwitch({ checked, onCheckedChange, label, disabled = false }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
}) {
    return <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className="inline-flex min-h-9 items-center gap-2.5 rounded-md px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
        <span aria-hidden="true" className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 ${checked ? 'border-primary bg-primary' : 'border-input bg-muted'}`}>
            <span className={`size-3.5 rounded-full motion-safe:transition-transform ${checked ? 'translate-x-4 bg-primary-foreground' : 'translate-x-0 bg-muted-foreground'}`} />
        </span>
        {label}
    </button>;
}
