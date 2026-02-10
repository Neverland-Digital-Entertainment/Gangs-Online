'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { NpcTemplateService } from '@/lib/npc/template-service';
import { ItemService } from '@/lib/item/service';
import { QuestBlueprintService } from '@/lib/quest/quest-service';
import type { NpcTemplate } from '@/types/npc';

interface ItemOption {
  id: string;
  name: string;
  category: string;
}

interface QuestOption {
  id: string;
  name: string;
}

interface QuestDataContextValue {
  npcTemplates: NpcTemplate[];
  items: ItemOption[];
  quests: QuestOption[];
  loading: boolean;
}

const QuestDataContext = createContext<QuestDataContextValue>({
  npcTemplates: [],
  items: [],
  quests: [],
  loading: true,
});

export function QuestDataProvider({ children }: { children: ReactNode }) {
  const [npcTemplates, setNpcTemplates] = useState<NpcTemplate[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [quests, setQuests] = useState<QuestOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [templates, allItems, allQuests] = await Promise.all([
          NpcTemplateService.getInstance().getAllTemplates(),
          ItemService.getInstance().getItems(),
          QuestBlueprintService.getInstance().getAllBlueprints(),
        ]);
        setNpcTemplates(templates);
        setItems(
          allItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            category: item.category || '',
          }))
        );
        setQuests(
          allQuests.map((q) => ({
            id: q.id,
            name: q.name,
          }))
        );
      } catch (err) {
        console.error('Failed to load quest data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <QuestDataContext.Provider value={{ npcTemplates, items, quests, loading }}>
      {children}
    </QuestDataContext.Provider>
  );
}

export function useQuestData() {
  return useContext(QuestDataContext);
}
