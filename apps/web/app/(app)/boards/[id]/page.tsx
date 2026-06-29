"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Board {
  id: number | string;
  name: string;
  visibility: string;
}

type Role = "owner" | "editor" | "viewer";

export default function BoardPage() {
  const params = useParams<{ id: string }>();
  const boardId = params.id;
  const [board, setBoard] = useState<Board | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/boards/${boardId}`);
      if (!alive) return;
      if (res.status === 401) return setError("请先登录"), setLoading(false);
      if (res.status === 403) return setError("你无权访问该白板"), setLoading(false);
      if (res.status === 404) return setError("白板不存在"), setLoading(false);
      const d = await res.json();
      setBoard(d.board);
      setRole(d.role);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [boardId]);

  if (loading) {
    return (
      <div data-testid="loading" className="flex h-[60vh] animate-pulse flex-col gap-4 p-6">
        <div className="h-10 w-1/3 rounded bg-muted" />
        <div className="flex-1 rounded-lg bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  const canEdit = role === "owner" || role === "editor";

  return (
    <div className="flex h-[80vh] flex-col">
      {/* Header 占位（真实 Header 功能在 p7） */}
      <header
        data-testid="board-header"
        className="flex items-center justify-between border-b bg-card px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <h1 data-testid="board-title" className="text-base font-semibold text-foreground">
            {board?.name}
          </h1>
          <Badge variant="muted" data-testid="board-role">
            {role}
          </Badge>
        </div>
        {/* 只读角色隐藏编辑入口 */}
        {canEdit && (
          <Button data-testid="board-edit-entry" size="sm" variant="secondary">
            编辑
          </Button>
        )}
      </header>

      {/* 画布容器占位（真实画布编辑在 p6） */}
      <div className="relative flex-1 overflow-hidden bg-muted/30">
        <div
          data-testid="canvas-placeholder"
          className="flex h-full items-center justify-center text-sm text-muted-foreground"
        >
          画布区域（p6 接入编辑能力）
        </div>
        {/* 缩放 / 小地图入口占位（真实在 p6） */}
        <div
          data-testid="zoom-minimap-placeholder"
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm"
        >
          100% · 小地图
        </div>
      </div>
    </div>
  );
}
