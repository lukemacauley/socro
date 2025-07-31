import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ArrowUp, ArrowDown } from "lucide-react";

interface InfiniteScrollDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  paginatedQuery: {
    results: TData[];
    loadMore: (numItems: number) => void;
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  };
  sortConfig?: {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };
  onSort?: (column: string) => void;
}

export function InfiniteScrollDataTable<TData, TValue>({
  columns,
  paginatedQuery,
  sortConfig,
  onSort,
}: InfiniteScrollDataTableProps<TData, TValue>) {
  const { results, loadMore, status } = paginatedQuery;
  const [sorting, setSorting] = useState<SortingState>([]);
  const observerTarget = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: results,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      loadMore(25);
    }
  }, [status, loadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && status === "CanLoadMore") {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [status, handleLoadMore]);

  const isInitialLoading = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";

  return (
    <div className="overflow-hidden rounded-md border border-sidebar-border">
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const accessorKey = (header.column.columnDef as any)
                    .accessorKey;
                  const canSort = accessorKey && onSort;
                  const isSorted = sortConfig?.sortBy === accessorKey;
                  const isAsc = isSorted && sortConfig?.sortOrder === "asc";
                  const isDesc = isSorted && sortConfig?.sortOrder === "desc";

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={() => onSort(accessorKey)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {isAsc ? (
                            <ArrowUp className="size-4" />
                          ) : isDesc ? (
                            <ArrowDown className="size-4" />
                          ) : (
                            <ArrowUp className="size-4 invisible" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {(status === "CanLoadMore" || isLoadingMore) && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-16 text-center"
                    >
                      <div ref={observerTarget} className="flex justify-center">
                        {isLoadingMore && (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {isInitialLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  ) : (
                    "No results."
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
