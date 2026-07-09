"use client";
// 编辑标签弹窗（F04 卡片菜单"编辑标签"）：多标签增删 + 保存。对齐 oldcode uc-board-005。
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TagInput } from "./tag-input";

interface Props {
  open: boolean;
  boardName: string;
  initialTags: string[];
  onClose: () => void;
  onSave: (tags: string[]) => void;
}

export function EditTagsDialog({ open, boardName, initialTags, onClose, onSave }: Props) {
  const [tags, setTags] = useState<string[]>(initialTags);

  // 每次打开同步到目标 board 的当前标签
  useEffect(() => {
    if (open) setTags(initialTags);
  }, [open, initialTags]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="编辑标签"
      description={boardName}
      testId="board-tags-dialog"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            data-testid="board-tags-save"
            onClick={() => {
              onSave(tags);
              onClose();
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label>标签</Label>
        <TagInput value={tags} onChange={setTags} inputTestId="board-tags-input" chipTestIdPrefix="board-tags-chip" />
      </div>
    </Dialog>
  );
}
