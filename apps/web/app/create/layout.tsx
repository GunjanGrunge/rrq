import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-bg-base overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-bg-base">{children}</main>
      </div>
    </div>
  );
}
