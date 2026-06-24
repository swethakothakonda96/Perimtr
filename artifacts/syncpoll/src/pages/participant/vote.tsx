import { ParticipantLayout } from "@/components/layout/ParticipantLayout";
import { useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useDeviceFingerprint } from "@/lib/fingerprint";
import { useVerifyNetwork, useGetPoll, useCastVote, useGetOrCreateDeviceToken, getGetPollQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function VotePoll() {
  const params = useParams();
  const pollId = parseInt(params.pollId || "0");
  const fingerprint = useDeviceFingerprint();

  const { data: poll, isLoading: pollLoading } = useGetPoll(pollId, {
    query: { enabled: !!pollId, queryKey: getGetPollQueryKey(pollId) },
  });

  const getOrCreateDeviceToken = useGetOrCreateDeviceToken();
  const verifyNetwork = useVerifyNetwork();
  const castVote = useCastVote();

  const initStarted = useRef(false);

  const [networkStatus, setNetworkStatus] = useState<"verifying" | "allowed" | "denied">("verifying");
  const [networkReason, setNetworkReason] = useState("");
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  const [pin, setPin] = useState("");
  const [voteError, setVoteError] = useState("");
  const [success, setSuccess] = useState(false);
  const [votedOption, setVotedOption] = useState<string | null>(null);

  useEffect(() => {
    if (!fingerprint || !pollId || initStarted.current) return;
    initStarted.current = true;

    getOrCreateDeviceToken.mutate(
      { data: fingerprint },
      {
        onSuccess: (res) => {
          setDeviceToken(res.token);
          verifyNetwork.mutate(
            { data: { pollId } },
            {
              onSuccess: (netRes) => {
                if (netRes.allowed) {
                  setNetworkStatus("allowed");
                } else {
                  setNetworkStatus("denied");
                  setNetworkReason(netRes.reason);
                }
              },
              onError: (err: any) => {
                setNetworkStatus("denied");
                setNetworkReason(
                  err?.data?.error ?? "Network verification failed. Please try again."
                );
              },
            }
          );
        },
        onError: (err: any) => {
          setNetworkStatus("denied");
          setNetworkReason(
            err?.data?.error ?? "Device registration failed. Please ensure your browser supports cookies."
          );
        },
      }
    );
  }, [fingerprint, pollId]);

  const handleVote = (optionIndex: number) => {
    if (!deviceToken || !poll) return;

    if (poll.pinRequired && pin.length !== 4) {
      setVoteError("A 4-digit PIN is required to vote.");
      return;
    }

    setVoteError("");

    castVote.mutate(
      {
        id: pollId,
        data: {
          optionIndex,
          deviceToken,
          pin: poll.pinRequired ? pin : undefined,
        },
      },
      {
        onSuccess: (res) => {
          if (res.success) {
            setSuccess(true);
            setVotedOption(poll.options[optionIndex]);
          }
        },
        onError: (error: any) => {
          const msg = error?.data?.error || "Voting failed.";
          if (
            msg.includes("already voted") ||
            msg.includes("already cast") ||
            msg.includes("already registered")
          ) {
            setNetworkStatus("denied");
            setNetworkReason("Already Recorded — Your vote has already been registered on this device.");
            return;
          }
          setVoteError(msg);
        },
      }
    );
  };

  if (success) {
    return (
      <ParticipantLayout>
        <div className="w-full flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center mb-2">Vote Recorded</h1>
          <p className="text-muted-foreground text-center">
            You voted for: <strong className="text-foreground block mt-2 text-xl">{votedOption}</strong>
          </p>
          <p className="text-sm text-muted-foreground mt-8">You may now close this page.</p>
        </div>
      </ParticipantLayout>
    );
  }

  if (networkStatus === "verifying" || pollLoading) {
    return (
      <ParticipantLayout>
        <div className="w-full flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground font-medium animate-pulse">Establishing secure connection...</p>
        </div>
      </ParticipantLayout>
    );
  }

  if (networkStatus === "denied") {
    return (
      <ParticipantLayout>
        <div className="w-full flex-1 flex flex-col items-center justify-center">
          <Card className="w-full border-destructive/50 bg-destructive/5">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm">{networkReason}</p>
            </CardContent>
          </Card>
        </div>
      </ParticipantLayout>
    );
  }

  if (!poll || poll.status === "ended") {
    return (
      <ParticipantLayout>
        <div className="w-full flex-1 flex flex-col items-center justify-center">
          <Card className="w-full">
            <CardHeader className="text-center">
              <CardTitle>Poll Closed</CardTitle>
              <CardDescription>This poll is no longer accepting votes.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ParticipantLayout>
    );
  }

  return (
    <ParticipantLayout>
      <div className="w-full space-y-6">
        {voteError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{voteError}</AlertDescription>
          </Alert>
        )}

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-balance leading-tight">{poll.question}</h1>
        </div>

        {poll.pinRequired && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 flex flex-col items-center">
              <label className="text-sm font-medium mb-3">Enter Poll PIN</label>
              <InputOTP maxLength={4} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-12 h-12 bg-background" />
                  <InputOTPSlot index={1} className="w-12 h-12 bg-background" />
                  <InputOTPSlot index={2} className="w-12 h-12 bg-background" />
                  <InputOTPSlot index={3} className="w-12 h-12 bg-background" />
                </InputOTPGroup>
              </InputOTP>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3">
          {poll.options.map((option, idx) => (
            <Button
              key={idx}
              data-testid={`button-option-${idx}`}
              variant="outline"
              className="w-full h-auto py-4 px-6 justify-start text-left text-base font-normal hover:bg-primary/5 hover:text-primary hover:border-primary transition-all whitespace-normal"
              disabled={castVote.isPending || (poll.pinRequired && pin.length !== 4)}
              onClick={() => handleVote(idx)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
    </ParticipantLayout>
  );
}
