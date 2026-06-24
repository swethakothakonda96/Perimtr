import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useGetSession,
  getGetSessionQueryKey,
  getGetSessionStatsQueryKey,
  getListAttendeesQueryKey,
  useGetSessionStats,
  useListAttendees,
  useUpdateSession,
  useDeleteSession,
} from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { format, differenceInSeconds } from "date-fns";
import { ShieldCheck, Download, StopCircle, Clock, Users, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function SessionDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0");
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteSession = useDeleteSession();

  // Queries with auto-refresh if session is active
  const { data: session, isLoading: sessionLoading } = useGetSession(id, {
    query: {
      enabled: !!id,
      queryKey: getGetSessionQueryKey(id),
      refetchInterval: (query) => (query.state.data?.status === "active" ? 2000 : false),
    },
  });

  const { data: stats } = useGetSessionStats(id, {
    query: {
      queryKey: getGetSessionStatsQueryKey(id),
      enabled: !!id && session?.status === "active",
      refetchInterval: 2000,
    },
  });

  const { data: attendees } = useListAttendees(id, {
    query: {
      queryKey: getListAttendeesQueryKey(id),
      enabled: !!id,
      refetchInterval: session?.status === "active" ? 2000 : false,
    },
  });

  const updateSession = useUpdateSession();

  // Countdown timer logic
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (session?.status === "active" && session.expiresAt) {
      const updateTimer = () => {
        const seconds = differenceInSeconds(new Date(session.expiresAt), new Date());
        if (seconds <= 0) {
          setTimeLeft(0);
          if (timerRef.current) clearInterval(timerRef.current);
          queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
        } else {
          setTimeLeft(seconds);
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setTimeLeft(null);
      return;
    }
  }, [session?.status, session?.expiresAt, id, queryClient]);

  const handleEndSession = () => {
    updateSession.mutate(
      { id, data: { status: "ended" } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetSessionQueryKey(id), data);
          toast({ title: "Session Ended", description: "No further check-ins are allowed." });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteSession.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Session deleted", description: "The session has been permanently removed." });
          setLocation("/sessions");
        },
        onError: () => {
          toast({ title: "Delete failed", description: "Could not delete session. Please try again.", variant: "destructive" });
          setShowDeleteDialog(false);
        },
      }
    );
  };

  const joinUrl = `${window.location.origin}/join/${id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;

  if (sessionLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!session) return null;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{session.title}</h1>
              <Badge variant={session.status === "active" ? "default" : "secondary"} className="text-sm py-1 px-3">
                {session.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Created {format(new Date(session.createdAt), "MMM d, h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.location.href = `/api/sessions/${id}/export`}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            {session.status === "active" && (
              <Button variant="destructive" onClick={handleEndSession} disabled={updateSession.isPending}>
                <StopCircle className="w-4 h-4 mr-2" />
                End Early
              </Button>
            )}
            <Button variant="outline" className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Live Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Info */}
          <Card className="md:col-span-2 border-primary/20 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <ShieldCheck className="w-64 h-64" />
            </div>
            <CardHeader>
              <CardTitle>Access Credentials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">SESSION PIN</p>
                    <div className="text-6xl font-mono font-black tracking-widest text-primary bg-muted/50 p-4 rounded-lg inline-block border border-border">
                      {session.pin}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">JOIN LINK</p>
                    <div className="flex gap-2">
                      <Input readOnly value={joinUrl} className="bg-muted/30 font-mono text-sm" />
                      <Button variant="outline" onClick={() => {
                          const fallback = () => {
                            const el = document.createElement("textarea");
                            el.value = joinUrl;
                            el.style.position = "fixed";
                            el.style.opacity = "0";
                            document.body.appendChild(el);
                            el.select();
                            document.execCommand("copy");
                            document.body.removeChild(el);
                            toast({ title: "Copied!" });
                          };
                          if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(joinUrl)
                              .then(() => toast({ title: "Copied!" }))
                              .catch(fallback);
                          } else {
                            fallback();
                          }
                        }}>
                        Copy
                      </Button>
                    </div>
                  </div>
                  {session.status === "active" && timeLeft !== null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">TIME REMAINING</p>
                      <div className="text-3xl font-bold text-destructive flex items-center gap-2">
                        <Clock className="w-6 h-6" />
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center justify-center border-l border-border pl-8">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
                    <img src={qrUrl} alt="Join QR Code" className="w-48 h-48" />
                  </div>
                  <p className="text-sm font-medium mt-4 flex items-center gap-2 text-muted-foreground">
                    <QrCode className="w-4 h-4" /> Scan to join
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Live Attendance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="text-7xl font-black text-primary">
                {session.attendeeCount || 0}
              </div>
              <p className="text-muted-foreground font-medium uppercase tracking-wider text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Verified Attendees
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Chart */}
        {stats?.checkInsOverTime && stats.checkInsOverTime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Check-in Velocity</CardTitle>
              <CardDescription>Rate of incoming verification requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.checkInsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="time" 
                      tickFormatter={(val) => format(new Date(val), "HH:mm:ss")}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip 
                      labelFormatter={(val) => format(new Date(val), "HH:mm:ss")}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendee Roster */}
        <Card>
          <CardHeader>
            <CardTitle>Verified Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Device Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!attendees?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No attendees have checked in yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  attendees.map((attendee: any) => (
                    <TableRow key={attendee.id}>
                      <TableCell className="font-medium">{attendee.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(attendee.checkedInAt), "HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {attendee.ipAddress || "Unknown"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {attendee.deviceToken.substring(0, 16)}...
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground space-y-0.5">
                        {attendee.deviceInfo ? (
                          <>
                            <div>{attendee.deviceInfo.platform ?? "—"} · {attendee.deviceInfo.screenResolution ?? "—"}</div>
                            <div>{attendee.deviceInfo.timezone ?? "—"}</div>
                            <div>{attendee.deviceInfo.hardwareConcurrency ? `${attendee.deviceInfo.hardwareConcurrency} cores` : ""}{attendee.deviceInfo.deviceMemory && attendee.deviceInfo.deviceMemory !== "unknown" ? ` · ${attendee.deviceInfo.deviceMemory}GB RAM` : ""}</div>
                          </>
                        ) : <span>—</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{session.title}</strong> and all{" "}
              <strong>{session.attendeeCount ?? 0} attendee record{(session.attendeeCount ?? 0) !== 1 ? "s" : ""}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteSession.isPending}
            >
              {deleteSession.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
