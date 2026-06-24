import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListSessions, useDeleteSession, getListSessionsQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Plus, Users, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
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

export default function SessionsList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useListSessions();
  const deleteSession = useDeleteSession();

  const [confirmId, setConfirmId] = useState<number | null>(null);
  const confirmSession = sessions?.find((s) => s.id === confirmId);

  const handleDelete = () => {
    if (confirmId == null) return;
    deleteSession.mutate(
      { id: confirmId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          toast({ title: "Session deleted", description: "The session and all its attendees have been removed." });
          setConfirmId(null);
        },
        onError: () => {
          toast({ title: "Delete failed", description: "Could not delete session. Please try again.", variant: "destructive" });
          setConfirmId(null);
        },
      }
    );
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Sessions</h1>
          <p className="text-muted-foreground mt-1">Manage active and past verification events.</p>
        </div>
        <Link href="/sessions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </Link>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attendees</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : sessions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No sessions found. Create your first attendance session.
                </TableCell>
              </TableRow>
            ) : (
              sessions?.map((session) => (
                <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                  <TableCell className="font-medium">
                    <Link href={`/sessions/${session.id}`} className="hover:underline hover:text-primary">
                      {session.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={session.status === "active" ? "default" : "secondary"}>
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      {session.attendeeCount || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${session.id}`}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setLocation(`/sessions/${session.id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => window.location.href = `/api/sessions/${session.id}/export`}
                        >
                          Export CSV
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive"
                          data-testid={`button-delete-${session.id}`}
                          onClick={() => setConfirmId(session.id)}
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
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{confirmSession?.title}</strong> and all{" "}
              <strong>{confirmSession?.attendeeCount ?? 0} attendee record{(confirmSession?.attendeeCount ?? 0) !== 1 ? "s" : ""}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteSession.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteSession.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
