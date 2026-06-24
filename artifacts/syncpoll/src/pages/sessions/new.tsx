import { AdminLayout } from "@/components/layout/AdminLayout";
import { useCreateSession } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Fingerprint } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
  duration: z.string(),
  customDuration: z.string().optional(),
});

export default function CreateSession() {
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      duration: "120",
      customDuration: "",
    },
  });

  const durationMode = form.watch("duration");

  function onSubmit(values: z.infer<typeof formSchema>) {
    let durationSeconds = parseInt(values.duration);
    if (values.duration === "custom" && values.customDuration) {
      durationSeconds = parseInt(values.customDuration);
    }

    if (isNaN(durationSeconds) || durationSeconds < 30) {
      toast({
        title: "Invalid duration",
        description: "Duration must be at least 30 seconds.",
        variant: "destructive",
      });
      return;
    }

    createSession.mutate(
      { data: { title: values.title, durationSeconds } },
      {
        onSuccess: (session) => {
          toast({
            title: "Session Created",
            description: "Session is now active and accepting check-ins.",
          });
          setLocation(`/sessions/${session.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create session. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">New Session</h1>
          <p className="text-muted-foreground mt-1">Deploy a new attendance verification event.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Session Details</CardTitle>
                    <CardDescription>
                      Configure the parameters for your verification session.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. COMP101 Lecture 4" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Window</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="60">60 Seconds</SelectItem>
                              <SelectItem value="120">2 Minutes</SelectItem>
                              <SelectItem value="300">5 Minutes</SelectItem>
                              <SelectItem value="custom">Custom...</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            How long the check-in window remains open.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {durationMode === "custom" && (
                      <FormField
                        control={form.control}
                        name="customDuration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Duration (seconds)</FormLabel>
                            <FormControl>
                              <Input type="number" min="30" placeholder="180" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                  </CardContent>
                </Card>

                <Button type="submit" className="w-full" disabled={createSession.isPending}>
                  {createSession.isPending ? "Deploying..." : "Launch Session"}
                </Button>
              </form>
            </Form>
          </div>

          <div className="space-y-6">
            <Card className="bg-muted/50 border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  Security Enforced
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-4">
                <p>
                  Upon creation, Perimtr automatically enforces:
                </p>
                <ul className="space-y-2">
                  <li className="flex gap-2">
                    <Fingerprint className="w-4 h-4 text-primary shrink-0" />
                    <span>Device fingerprinting prevents multiple check-ins from the same phone.</span>
                  </li>
                  <li className="flex gap-2">
                    <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
                    <span>Network verification locks check-ins to your current Wi-Fi network.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
