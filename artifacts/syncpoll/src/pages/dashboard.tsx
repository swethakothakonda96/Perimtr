import { AdminLayout } from "@/components/layout/AdminLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BarChart3, Activity, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Live metrics across all active operations.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Sessions"
            value={stats?.activeSessions}
            icon={Activity}
            isLoading={isLoading}
          />
          <StatCard
            title="Total Attendees"
            value={stats?.totalAttendees}
            icon={Users}
            isLoading={isLoading}
          />
          <StatCard
            title="Active Polls"
            value={stats?.activePolls}
            icon={BarChart3}
            isLoading={isLoading}
          />
          <StatCard
            title="Total Votes"
            value={stats?.totalVotes}
            icon={Layers}
            isLoading={isLoading}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent stuff could go here, but for now we'll just have placeholders or leave empty as api doesn't explicitly return recent via stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-muted-foreground">Navigate to Sessions or Polls to create new instances.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  isLoading 
}: { 
  title: string; 
  value?: number; 
  icon: any; 
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-[100px]" />
        ) : (
          <div className="text-3xl font-bold">{value?.toLocaleString() || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
