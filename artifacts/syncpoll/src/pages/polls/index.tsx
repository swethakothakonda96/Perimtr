import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListPolls, useDeletePoll, getListPollsQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Plus, BarChart3, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export default function PollsList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: polls, isLoading } = useListPolls();
  const deletePoll = useDeletePoll();

  const [confirmId, setConfirmId] = useState<number | null>(null);
  const confirmPoll = polls?.find((p) => p.id === confirmId);

  const handleDelete = () => {
    if (confirmId == null) return;
    deletePoll.mutate(
      { id: confirmId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() });
          toast({ title: "Poll deleted", description: "The poll and all its votes have been removed." });
          setConfirmId(null);
        },
        onError: () => {
          toast({ title: "Delete failed", description: "Could not delete poll. Please try again.", variant: "destructive" });
          setConfirmId(null);
        },
      }
    );
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Polls</h1>
          <p className="text-muted-foreground mt-1">Engage your audience with secure real-time questions.</p>
        </div>
        <Link href="/polls/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Poll
          </Button>
        </Link>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Question</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Votes</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : polls?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No polls found. Create your first live poll.
                </TableCell>
              </TableRow>
            ) : (
              polls?.map((poll) => (
                <TableRow key={poll.id} data-testid={`row-poll-${poll.id}`}>
                  <TableCell className="font-medium">
                    <Link href={`/polls/${poll.id}`} className="hover:underline hover:text-primary">
                      {poll.question}
                    </Link>
                    {poll.pinRequired && (
                      <Badge variant="outline" className="ml-2 text-[10px]">PIN REQ</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={poll.status === "active" ? "default" : "secondary"}>
                      {poll.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BarChart3 className="w-3.5 h-3.5" />
                      {poll.totalVotes || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(poll.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${poll.id}`}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setLocation(`/polls/${poll.id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Results
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive"
                          data-testid={`button-delete-${poll.id}`}
                          onClick={() => setConfirmId(poll.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete poll?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the poll{" "}
              <strong>"{confirmPoll?.question}"</strong> and all{" "}
              <strong>{confirmPoll?.totalVotes ?? 0} vote{(confirmPoll?.totalVotes ?? 0) !== 1 ? "s" : ""}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deletePoll.isPending}
              data-testid="button-confirm-delete"
            >
              {deletePoll.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
