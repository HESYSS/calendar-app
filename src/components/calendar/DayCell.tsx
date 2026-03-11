"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import React, { useMemo, useState } from "react";
import styled from "styled-components";

import type { Holiday, Task } from "@/lib/types";

import TaskCard from "./TaskCard";

export default function DayCell({
  dateKey,
  date,
  inMonth,
  holiday,
  tasks,
  dndEnabled,
  editable,
  onCreate,
  onPatch,
  onDelete,
}: {
  dateKey: string;
  date: Date;
  inMonth: boolean;
  holiday?: Holiday[];
  tasks: Task[];
  dndEnabled: boolean;
  editable: boolean;
  onCreate: (date: string, title: string) => Promise<void>;
  onPatch: (id: string, patch: Partial<Pick<Task, "title" | "description" | "date" | "order">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey, disabled: !dndEnabled });
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [composing, setComposing] = useState(false);

  const items = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const dayNum = date.getDate();
  const isToday = (() => {
    const now = new Date();
    return (
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate()
    );
  })();

  async function submit() {
    const title = draft.trim();
    if (!title) return;
    setCreating(true);
    try {
      await onCreate(dateKey, title);
      setDraft("");
      setComposing(false);
    } catch {
      // handled by parent status text
    } finally {
      setCreating(false);
    }
  }

  const holidayLabels = (holiday || [])
    .map((h) => h.localName || h.name)
    .filter((x): x is string => Boolean(x));
  const cardCount = tasks.length > 0 ? `${tasks.length} card${tasks.length === 1 ? "" : "s"}` : "";
  const showAddLink = tasks.length === 0;

  return (
    <Cell $inMonth={inMonth} $over={isOver}>
      <Header>
        <Left>
          <DayNum $today={isToday}>{dayNum}</DayNum>
          {cardCount ? <Count>{cardCount}</Count> : null}
        </Left>
        <Spacer />
      </Header>

      <Body ref={setNodeRef}>
        {holidayLabels.length > 0 ? (
          <HolidayBlock aria-label="Holidays">
            {holidayLabels.map((h) => (
              <HolidayItem key={h}>{h}</HolidayItem>
            ))}
          </HolidayBlock>
        ) : null}
        {dndEnabled ? (
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <TaskList>
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} dndEnabled={dndEnabled} editable={editable} onPatch={onPatch} onDelete={onDelete} />
              ))}
            </TaskList>
          </SortableContext>
        ) : (
          <TaskList>
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} dndEnabled={false} editable={editable} onPatch={onPatch} onDelete={onDelete} />
            ))}
          </TaskList>
        )}

        {editable ? (
          composing ? (
            <Composer>
              <ComposerInput
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a card..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") {
                    setDraft("");
                    setComposing(false);
                  }
                }}
                disabled={creating}
              />
              <AddBtn onClick={submit} disabled={creating || !draft.trim()}>
                Add
              </AddBtn>
              <CancelBtn
                type="button"
                onClick={() => {
                  setDraft("");
                  setComposing(false);
                }}
                disabled={creating}
              >
                Cancel
              </CancelBtn>
            </Composer>
          ) : (
            <AddLink
              type="button"
              onClick={() => setComposing(true)}
              aria-label="Add card"
              title="Add card"
              $forceVisible={showAddLink}
            >
              + Add card
            </AddLink>
          )
        ) : null}
      </Body>
    </Cell>
  );
}

const Cell = styled.div<{ $inMonth: boolean; $over: boolean }>`
  height: 230px;
  display: flex;
  flex-direction: column;
  background: ${(p) => (p.$inMonth ? "var(--cell)" : "var(--cell-dim)")};
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 10px 10px 12px;
  overflow: hidden;
  outline: ${(p) => (p.$over ? "2px solid rgba(240, 140, 0, 0.4)" : "none")};
  outline-offset: -2px;
  transition: outline-color 120ms ease;

  @media (min-width: 920px) {
    height: 260px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

const Left = styled.div`
  display: flex;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
`;

const DayNum = styled.div<{ $today: boolean }>`
  font-weight: 700;
  font-size: 13px;
  color: ${(p) => (p.$today ? "var(--accent)" : "var(--muted)")};
`;

const Count = styled.div`
  font-size: 12px;
  color: var(--faint);
`;

const HolidayBlock = styled.div`
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  line-height: 1.25;
  white-space: normal;
  word-break: break-word;
`;

const HolidayItem = styled.div`
  &:not(:last-child) {
    margin-bottom: 4px;
  }
`;

const Spacer = styled.div`
  height: 26px;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
`;

const TaskList = styled.div`
  display: grid;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
  overscroll-behavior: contain;

  &::-webkit-scrollbar {
    width: 10px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scroll-thumb);
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
`;

const Composer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const ComposerInput = styled.input`
  flex: 1;
  height: 34px;
  border-radius: var(--radius-sm);
  padding: 0 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  outline: none;

  &:focus {
    border-color: rgba(240, 140, 0, 0.55);
    box-shadow: 0 0 0 3px rgba(240, 140, 0, 0.18);
  }
  &:disabled {
    opacity: 0.55;
  }
`;

const AddBtn = styled.button`
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  border: 1px solid var(--border);
  color: #fff;
  cursor: pointer;

  &:hover:enabled {
    filter: brightness(0.96);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelBtn = styled.button`
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.06);
  border: 1px solid var(--border);
  cursor: pointer;

  &:hover:enabled {
    background: rgba(0, 0, 0, 0.08);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AddLink = styled.button<{ $forceVisible: boolean }>`
  height: 34px;
  border-radius: var(--radius-sm);
  padding: 0 10px;
  background: transparent;
  border: 1px dashed var(--border-strong);
  color: var(--muted);
  cursor: pointer;
  justify-self: start;
  opacity: ${(p) => (p.$forceVisible ? 1 : 0)};
  transition: opacity 120ms ease, background 120ms ease;

  ${Cell}:hover & {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
`;
