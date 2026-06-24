import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useGetPoll,
  getGetPollQueryKey,
  getGetPollResultsQueryKey,
  useGetPollResults,
  useUpdatePoll,
  useDeletePoll,
} from "@workspace/api-client-react";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { StopCircle, BarChart3, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))"
];

export default function PollDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0");
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deletePoll = useDeletePoll();

  const { data: poll, isLoading: pollLoading } = useGetPoll(id, {
    query: {
      enabled: !!id,
      queryKey: getGetPollQueryKey(id),
      refetchInterval: (query) => (query.state.data?.status === "active" ? 3000 : false),
    },
  });

  const { data: results } = useGetPollResults(id, {
    query: {
      queryKey: getGetPollResultsQueryKey(id),
      enabled: !!id,
      refetchInterval: poll?.status === "active" ? 3000 : false,
    },
  });

  const updatePoll = useUpdatePoll();

  const handleEndPoll = () => {
    updatePoll.mutate(
      { id, data: { status: "ended" } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetPollQueryKey(id), data);
          toast({ title: "Poll Ended", description: "Voting is now closed." });
        },
      }
    );
  };

  const handleDelete = () => {
    deletePoll.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Poll deleted", description: "The poll has been permanently removed." });
          setLocation("/polls");
        },
        onError: () => {
          toast({ title: "Delete failed", description: "Could not delete poll. Please try again.", variant: "destructive" });
          setShowDeleteDialog(false);
        },
      }
    );
  };

  const voteUrl = `${window.location.origin}/vote/${id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(voteUrl)}`;

  if (pollLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-2/3" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-[400px] md:col-span-2" />
            <Skeleton className="h-[400px]" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!poll) return null;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant={poll.status === "active" ? "default" : "secondary"} className="text-sm py-1 px-3">
                {poll.status.toUpperCase()}
              </Badge>
              {poll.pinRequired && <Badge variant="outline">PIN REQ</Badge>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{poll.question}</h1>
          </div>
          <div className="flex items-center gap-2">
            {poll.status === "active" && (
              <Button variant="destructive" onClick={handleEndPoll} disabled={updatePoll.isPending}>
                <StopCircle className="w-4 h-4 mr-2" />
                Close Poll
              </Button>
            )}
            <Button variant="outline" className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Chart Area */}
          <Card className="md:col-span-2 border-primary/20 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Live Results</CardTitle>
              <div className="text-muted-foreground text-sm font-medium">
                {results?.totalVotes || 0} Total Votes
              </div>
            </CardHeader>
            <CardContent>
              {results?.options && results.options.length > 0 ? (
                <div className="h-[350px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={results.options} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 'dataMax']} hide />
                      <YAxis 
                        type="category" 
                        dataKey="label" 
                        stroke="hsl(var(--foreground))" 
                        fontSize={13}
                        fontWeight={500}
                        width={120}
                        tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                      />
                      <Tooltip
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontWeight: "bold" }}
                        formatter={(value, name, props) => [`${value} votes (${props.payload.percentage.toFixed(1)}%)`, ""]}
                      />
                      <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={40}>
                        {results.options.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground flex-col gap-2">
                  <BarChart3 className="w-12 h-12 opacity-20" />
                  <p>Awaiting votes...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connect Area */}
          <Card>
            <CardHeader>
              <CardTitle>Participant Access</CardTitle>
              <CardDescription>Share this to collect votes</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-6">
              
              {poll.pinRequired && poll.pin && (
                <div className="w-full text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">POLL PIN</p>
                  <div className="text-5xl font-mono font-black tracking-widest text-primary bg-muted/50 py-3 rounded-lg border border-border">
                    {poll.pin}
                  </div>
                </div>
              )}

              <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
                <img src={qrUrl} alt="Vote QR Code" className="w-48 h-48" />
              </div>
              
              <div className="w-full space-y-2">
                <p className="text-sm font-medium text-muted-foreground text-center mb-1">VOTING LINK</p>
                <div className="flex gap-2">
                  <Input readOnly value={voteUrl} className="bg-muted/30 font-mono text-xs" />
                  <Button variant="outline" onClick={() => {
                    const fallback = () => {
                      const el = document.createElement("textarea");
                      el.value = voteUrl;
                      el.style.position = "fixed";
                      el.style.opacity = "0";
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand("copy");
                      document.body.removeChild(el);
                      toast({ title: "Copied!" });
                    };
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(voteUrl)
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

            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete poll?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the poll <strong>"{poll.question}"</strong> and all{" "}
              <strong>{results?.totalVotes ?? 0} vote{(results?.totalVotes ?? 0) !== 1 ? "s" : ""}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deletePoll.isPending}
            >
              {deletePoll.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
