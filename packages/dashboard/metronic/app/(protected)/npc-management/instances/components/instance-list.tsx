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
import { ChevronRight, Plus, Search, X, MapPin } from 'lucide-react';
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
import {
  NpcInstance,
  MovementPattern,
  MOVEMENT_PATTERN_LABELS,
} from '../constants/types';
import InstanceAddDialog from './instance-add-dialog';

const InstanceList = () => {
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
  const [selectedMap, setSelectedMap] = useState<string | null>('all');

  const fetchInstances = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
    selectedMap,
  }: DataGridApiFetchParams & {
    selectedMap: string | null;
  }): Promise<DataGridApiResponse<NpcInstance>> => {
    const sortField = sorting?.[0]?.id || '';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String(pageIndex + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(selectedMap && selectedMap !== 'all' ? { mapId: selectedMap } : {}),
    });

    const response = await apiFetch(
      `/api/npc-management/instances?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error('無法載入 NPC 實例列表');
    }

    return response.json();
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'npc-instances',
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
      searchQuery,
      selectedMap,
    ],
    queryFn: () =>
      fetchInstances({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
        selectedMap,
      }),
  });

  const columns = useMemo<ColumnDef<NpcInstance>[]>(
    () => [
      {
        accessorKey: 'template.name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="模板名稱" />
        ),
        cell: ({ row }) => {
          const instance = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div>
                <a
                  href={`/npc-management/instances/${instance.id}`}
                  className="font-medium text-gray-900 hover:text-primary-600 dark:text-gray-100"
                >
                  {instance.template?.name || 'Unknown'}
                </a>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  等級 {instance.level}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'position',
        header: 'Position',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="h-3 w-3" />
            <span>
              ({row.original.positionX.toFixed(1)},{' '}
              {row.original.positionZ.toFixed(1)})
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'movementPattern',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="移動模式" />
        ),
        cell: ({ row }) => {
          const pattern = row.original.movementPattern;
          const label = MOVEMENT_PATTERN_LABELS[pattern];
          return <Badge variant="outline">{label}</Badge>;
        },
      },
      {
        accessorKey: 'mapId',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="地圖" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {row.original.mapId || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="狀態" />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
            {row.original.isActive ? '啟用' : '停用'}
          </Badge>
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
              onClick={() =>
                router.push(`/npc-management/instances/${row.original.id}`)
              }
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
                placeholder="搜尋..."
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
              value={selectedMap || 'all'}
              onValueChange={(value) =>
                setSelectedMap(value === 'all' ? null : value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="所有地圖" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有地圖</SelectItem>
                <SelectItem value="map_1">地圖 1</SelectItem>
                <SelectItem value="map_2">地圖 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4" />
            新增 NPC 實例
          </Button>
        </CardHeader>
        <CardTable>
          <ScrollArea className="h-full">
            <DataGridTable
              table={table}
              columns={columns}
              isLoading={isLoading}
            />
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

      <InstanceAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </>
  );
};

export default InstanceList;
