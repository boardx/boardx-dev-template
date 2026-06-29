import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">BoardX</h1>
      <p className="text-neutral-600">
        Open Creation Engine for AI-native work and learning.
      </p>
      <Badge variant="success" data-testid="status-badge">
        skeleton online
      </Badge>
    </main>
  );
}
