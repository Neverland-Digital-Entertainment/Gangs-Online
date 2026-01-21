'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronRight, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTable } from '@/components/ui/card';
import {
  DataGrid,
  DataGridApiFetchParams,
  DataGridApiResponse,
} from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { NpcTemplate, NpcType, NPC_TYPE_LABELS } from '../constants/types';
import TemplateAddDialog from './template-add-dialog';

const TemplateList = () => {
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>('all');

  // Fetch templates from the server API
  const fetchTemplates = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
    selectedType,
  }: DataGridApiFetchParams & {
    selectedType: string | null;
  }): Promise<DataGridApiResponse<NpcTemplate>> => {
    const sortField = sorting?.[0]?.id || '';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String(pageIndex + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(selectedType && selectedType !== 'all'
        ? { type: selectedType }
        : {}),
    });

    const response = await apiFetch(
      `/api/npc-management/templates?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error('無法載入 NPC 模板列表');
    }

    return response.json();
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'npc-templates',
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
      searchQuery,
      selectedType,
    ],
    queryFn: () =>
      fetchTemplates({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
        selectedType,
      }),
  });

  const columns = useMemo<ColumnDef<NpcTemplate>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="名稱" />
        ),
        cell: ({ row }) => {
          const template = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div>
                <a
                  href={`/npc-management/templates/${template.id}`}
                  className="font-medium text-gray-900 hover:text-primary-600 dark:text-gray-100"
                >
                  {template.name}
                </a>
                {template.description && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {template.description}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="類型" />
        ),
        cell: ({ row }) => {
          const type = row.original.type;
          const label = NPC_TYPE_LABELS[type];
          return <Badge variant="outline">{label}</Badge>;
        },
      },
      {
        accessorKey: 'modelId',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="模型 ID" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {row.original.modelId}
          </span>
        ),
      },
      {
        accessorKey: 'baseHp',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="基礎 HP" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.baseHp}</span>
        ),
      },
      {
        accessorKey: 'baseAttack',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="基礎攻擊" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.baseAttack}</span>
        ),
      },
      {
        accessorKey: 'baseDefense',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="基礎防禦" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.baseDefense}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="建立時間" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push(`/npc-management/templates/${row.original.id}`)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  const table = useReactTable({
    data: data?.items || [],
    columns,
    pageCount: data?.totalPages ?? 0,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="搜尋模板名稱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <Select
              value={selectedType || 'all'}
              onValueChange={(value) =>
                setSelectedType(value === 'all' ? null : value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="所有類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有類型</SelectItem>
                {Object.entries(NPC_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4" />
            新增模板
          </Button>
        </CardHeader>
        <CardTable>
          <ScrollArea className="h-full">
            <DataGridTable table={table} columns={columns} isLoading={isLoading} />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardTable>
        {data && (
          <CardFooter>
            <DataGridPagination
              table={table}
              totalItems={data.totalItems}
              totalPages={data.totalPages}
            />
          </CardFooter>
        )}
      </Card>

      <TemplateAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </>
  );
};

export default TemplateList;
