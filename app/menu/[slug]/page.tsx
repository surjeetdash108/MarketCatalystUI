import { notFound } from "next/navigation";
import { AuthGuard } from "../../dashboard/auth-guard";
import { BackButton } from "../../dashboard/back-button";
import { getMenuItemBySlug, menuItems } from "../../dashboard/menu-items";
import { Sidebar } from "../../dashboard/sidebar";

export function generateStaticParams() {
  return menuItems
    .filter((item) => item.slug !== "dashboard")
    .map((item) => ({ slug: item.slug }));
}

export default async function MenuDetailPage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const item = getMenuItemBySlug(slug);

  if (!item || item.slug === "dashboard") {
    notFound();
  }

  return (
    <AuthGuard>
      <main className="relative min-h-screen bg-[#f4f6f8] text-[#17231d]">
        <div className="mx-auto flex max-w-[1520px]">
          <Sidebar currentSlug={slug} />

          <div className="min-w-0 flex-1 px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-5xl">
              <BackButton />

              <section className="rounded-md border border-[#dde5df] bg-white p-6 shadow-sm shadow-slate-200/50">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#166052]">
                  finapp26 module
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  {item.label}
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[#52645b]">
                  {item.description}
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {["Overview", "Signals", "Actions"].map((section) => (
                    <div
                      className="rounded-md border border-[#e5ebe7] bg-[#fbfcfb] p-4"
                      key={section}
                    >
                      <p className="text-sm font-semibold text-[#17231d]">
                        {section}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#52645b]">
                        This section is ready for {item.label.toLowerCase()} data,
                        workflows, and controls.
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
