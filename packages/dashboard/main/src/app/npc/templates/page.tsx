export default function TemplatesPage() {
  return (
    <div className="container-fixed">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          NPC 模板管理
        </h1>
        <p className="text-[var(--muted-foreground)]">
          管理 NPC 模板定義、基礎屬性和對話樹
        </p>
      </div>

      <div className="card">
        <div className="card-body text-center py-12">
          <p className="text-[var(--muted-foreground)] mb-4">
            模板列表和管理功能將在此處顯示
          </p>
          <p className="text-sm text-[var(--muted)]">
            此功能需要整合後端 API 才能完整運作
          </p>
        </div>
      </div>
    </div>
  );
}
