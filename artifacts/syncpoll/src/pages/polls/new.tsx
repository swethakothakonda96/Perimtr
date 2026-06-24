import { AdminLayout } from "@/components/layout/AdminLayout";
import { useCreatePoll } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ShieldAlert, Sparkles, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  question: z.string().min(5, { message: "Question must be at least 5 characters." }),
  options: z.array(z.object({
    value: z.string().min(1, { message: "Option cannot be empty" })
  })).min(2, { message: "Provide at least 2 options." }).max(6, { message: "Maximum 6 options." }),
  pinRequired: z.boolean().default(false),
});

type SuggestionType = "multiple" | "yesno" | "rating";

type PollSuggestion = {
  question: string;
  options: string[];
};

const MULTIPLE_CHOICE_TEMPLATES = [
  "Which challenge in {topic} should we prioritize first?",
  "What matters most to improve outcomes in {topic}?",
  "Which approach would make {topic} easier to adopt?",
  "What is the biggest barrier to success in {topic} right now?",
];

const YES_NO_TEMPLATES = [
  "Should we increase focus on {topic} this month?",
  "Do you feel current support for {topic} is sufficient?",
  "Should {topic} be included in the next action plan?",
];

const RATING_TEMPLATES = [
  "How confident are you in your understanding of {topic}?",
  "How effective are our current efforts around {topic}?",
  "How urgent is improvement in {topic}?",
];

function parseCategoryOptions(topic: string): string[] {
  const parsed = topic
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parsed.length >= 2) {
    return Array.from(new Set(parsed)).slice(0, 6);
  }
  return ["Option A", "Option B", "Option C", "Option D"];
}

export default function CreatePoll() {
  const [, setLocation] = useLocation();
  const createPoll = useCreatePoll();
  const [topic, setTopic] = useState("");
  const [suggestionType, setSuggestionType] = useState<SuggestionType>("multiple");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      options: [{ value: "" }, { value: "" }],
      pinRequired: false,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const suggestions = useMemo<PollSuggestion[]>(() => {
    const normalizedTopic = topic.trim();
    if (!normalizedTopic) return [];

    if (suggestionType === "yesno") {
      return YES_NO_TEMPLATES.map((template) => ({
        question: template.replace("{topic}", normalizedTopic),
        options: ["Yes", "No"],
      }));
    }

    if (suggestionType === "rating") {
      return RATING_TEMPLATES.map((template) => ({
        question: template.replace("{topic}", normalizedTopic),
        options: ["Excellent", "Good", "Fair", "Poor"],
      }));
    }

    const categoryOptions = parseCategoryOptions(normalizedTopic);
    return MULTIPLE_CHOICE_TEMPLATES.map((template) => ({
      question: template.replace("{topic}", normalizedTopic),
      options: categoryOptions,
    }));
  }, [topic, suggestionType]);

  const applySuggestion = (suggestion: PollSuggestion) => {
    form.setValue("question", suggestion.question, { shouldDirty: true, shouldValidate: true });
    replace(suggestion.options.map((value) => ({ value })));
    toast({
      title: "Suggestion Applied",
      description: "Question and starter options were added. You can edit them before launch.",
    });
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    createPoll.mutate(
      { 
        data: { 
          question: values.question, 
          options: values.options.map(o => o.value),
          pinRequired: values.pinRequired
        } 
      },
      {
        onSuccess: (poll) => {
          toast({
            title: "Poll Created",
            description: "Poll is now live and accepting votes.",
          });
          setLocation(`/polls/${poll.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create poll. Please try again.",
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
          <h1 className="text-3xl font-bold tracking-tight">New Poll</h1>
          <p className="text-muted-foreground mt-1">Deploy a real-time secure poll.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Suggestions
                </CardTitle>
                <CardDescription>
                  Enter a topic to get smarter question suggestions by poll type.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Try: AI in education, attendance policy, hybrid classes..."
                    className="pl-9"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={suggestionType === "multiple" ? "default" : "outline"}
                    onClick={() => setSuggestionType("multiple")}
                  >
                    Multiple Choice
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={suggestionType === "yesno" ? "default" : "outline"}
                    onClick={() => setSuggestionType("yesno")}
                  >
                    Yes/No
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={suggestionType === "rating" ? "default" : "outline"}
                    onClick={() => setSuggestionType("rating")}
                  >
                    Rating
                  </Button>
                </div>

                {topic.trim() ? (
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                      <div
                        key={suggestion.question}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border p-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm">{suggestion.question}</p>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.options.join(" / ")}
                          </p>
                        </div>
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => applySuggestion(suggestion)}
                          >
                            Use
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Start typing a topic above to see suggested poll questions.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Poll Details</CardTitle>
                <CardDescription>
                  Define your question and possible answers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="question"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Question Prompt</FormLabel>
                      <FormControl>
                        <Input placeholder="What is your primary concern regarding..." className="text-lg py-6" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <p className="text-sm font-medium leading-none">Options</p>
                  {fields.map((field, index) => (
                    <FormField
                      key={field.id}
                      control={form.control}
                      name={`options.${index}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder={`Option ${index + 1}`} {...field} />
                            </FormControl>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length <= 2}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  
                  {fields.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ value: "" })}
                      className="mt-2"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Option
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <FormField
                  control={form.control}
                  name="pinRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-primary" />
                          Require PIN Access
                        </FormLabel>
                        <FormDescription>
                          Voters will need a generated 4-digit PIN to access this poll.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-12 text-lg" disabled={createPoll.isPending}>
              {createPoll.isPending ? "Deploying..." : "Launch Poll"}
            </Button>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}
