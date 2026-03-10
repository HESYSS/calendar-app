"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";

import type { Task } from "@/lib/types";

const LABEL_COLORS = ["#37b24d", "#f59f00", "#339af0", "#ae3ec9", "#15aabf", "#f03e3e"];

function pickLabelColors(id: string) {
  let acc = 0;
  for (let i = 0; i < id.length; i++) acc = (acc * 31 + id.charCodeAt(i)) >>> 0;
  const a = LABEL_COLORS[acc % LABEL_COLORS.length]!;
  const b = LABEL_COLORS[(acc + 2) % LABEL_COLORS.length]!;
  const c = LABEL_COLORS[(acc + 4) % LABEL_COLORS.length]!;
  return [a, b, c] as const;
}

export default function TaskCard({
  task,
  dndEnabled,
  editable,
  onPatch,
  onDelete,
}: {
  task: Task;
  dndEnabled: boolean;
  editable: boolean;
  onPatch: (id: string, patch: Partial<Pick<Task, "title" | "description" | "date" | "order">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !dndEnabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    if (!editable) return;
    setValue(task.title);
    setEditing(true);
  }

  async function commit() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === task.title) {
      setValue(task.title);
      return;
    }
    await onPatch(task.id, { title: next });
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      $dragging={isDragging}
      $draggable={dndEnabled}
      $editable={editable}
    >
      <LabelBars aria-hidden="true">
        {pickLabelColors(task.id).map((c) => (
          <Bar key={c} $c={c} />
        ))}
      </LabelBars>
      {editing ? (
        <EditInput
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit().catch(() => setValue(task.title))}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit().catch(() => setValue(task.title));
            if (e.key === "Escape") {
              setEditing(false);
              setValue(task.title);
            }
          }}
        />
      ) : (
        <Row>
          <Text onDoubleClick={startEdit} title={task.title}>
            {task.title}
          </Text>
          <Actions>
            <ActionBtn onClick={startEdit} aria-label="Edit task">
              Edit
            </ActionBtn>
            <DangerBtn
              onClick={() => (editable ? onDelete(task.id).catch(() => undefined) : undefined)}
              aria-label="Delete task"
              title="Delete"
              disabled={!editable}
            >
              x
            </DangerBtn>
          </Actions>
        </Row>
      )}
    </Card>
  );
}

const Card = styled.div<{ $dragging: boolean; $draggable: boolean; $editable: boolean }>`
  border-radius: 4px;
  padding: 8px 10px 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  cursor: ${(p) => (p.$draggable ? "grab" : "default")};
  opacity: ${(p) => (!p.$editable ? 0.85 : 1)};
`;

const LabelBars = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
`;

const Bar = styled.div<{ $c: string }>`
  height: 6px;
  width: 32px;
  border-radius: 999px;
  background: ${(p) => p.$c};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Text = styled.div`
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ActionBtn = styled.button`
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--muted);
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
`;

const DangerBtn = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 10px;
  border: 1px solid rgba(224, 49, 49, 0.25);
  background: rgba(224, 49, 49, 0.1);
  cursor: pointer;

  &:hover {
    background: rgba(224, 49, 49, 0.14);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EditInput = styled.input`
  width: 100%;
  height: 30px;
  border-radius: 10px;
  padding: 0 10px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.16);
  outline: none;

  &:focus {
    border-color: rgba(116, 240, 197, 0.45);
    box-shadow: 0 0 0 3px rgba(116, 240, 197, 0.12);
  }
`;
