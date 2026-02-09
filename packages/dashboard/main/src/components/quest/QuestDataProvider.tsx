'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { NpcTemplateService } from '@/lib/npc/template-service';
import { ItemService } from '@/lib/item/service';
import type { NpcTemplate } from '@/types/npc';

interface ItemOption {
  id: string;
  name: string;
  category: string;
}

interface QuestDataContextValue {
  npcTemplates: NpcTemplate[];
  items: ItemOption[];
  loading: boolean;
}

const QuestDataContext = createContext<QuestDataContextValue>({
  npcTemplates: [],
  items: [],
  loading: true,
});

export function QuestDataProvider({ children }: { children: ReactNode }) {
  const [npcTemplates, setNpcTemplates] = useState<NpcTemplate[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [templates, allItems] = await Promise.all([
          NpcTemplateService.getInstance().getAllTemplates(),
          ItemService.getInstance().getItems(),
        ]);
        setNpcTemplates(templates);
        setItems(
          allItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            category: item.category || '',
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
    <QuestDataContext.Provider value={{ npcTemplates, items, loading }}>
      {children}
    </QuestDataContext.Provider>
  );
}

export function useQuestData() {
  return useContext(QuestDataContext);
}
