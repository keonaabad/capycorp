import { CreateBusinessForm } from "@/components/business/create-business-form";

/**
 * The "blank new chat" screen — shown when no business is selected in
 * the sidebar. `BusinessLayout` already handles auth and the sidebar
 * itself, so this is just the empty-state content.
 */
export default function BusinessIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-12">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-ink">
          Select a business, or start a new one
        </h1>
        <p className="text-sm text-muted">
          Each business gets its own office and starter team of four agents.
        </p>
      </div>
      <div className="w-full max-w-md">
        <CreateBusinessForm />
      </div>
    </div>
  );
}
