import { ParticipantLayout } from "@/components/layout/ParticipantLayout";
import { useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useDeviceFingerprint } from "@/lib/fingerprint";
import { useVerifyNetwork, useCheckIn, useGetOrCreateDeviceToken } from "@workspace/api-client-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function JoinSession() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");
  const fingerprint = useDeviceFingerprint();

  const getOrCreateDeviceToken = useGetOrCreateDeviceToken();
  const verifyNetwork = useVerifyNetwork();
  const checkIn = useCheckIn();

  const initStarted = useRef(false);

  const [networkStatus, setNetworkStatus] = useState<"verifying" | "allowed" | "denied">("verifying");
  const [networkReason, setNetworkReason] = useState("");
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [checkInError, setCheckInError] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const [success, setSuccess] = useState(false);
  const [checkedInName, setCheckedInName] = useState("");

  useEffect(() => {
    if (!fingerprint || !sessionId || initStarted.current) return;
    initStarted.current = true;

    getOrCreateDeviceToken.mutate(
      { data: fingerprint },
      {
        onSuccess: (res) => {
          setDeviceToken(res.token);
          verifyNetwork.mutate(
            { data: { sessionId } },
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
  }, [fingerprint, sessionId]);

  const handleCheckIn = () => {
    if (!name || pin.length !== 4 || !deviceToken) return;
    setCheckInError("");

    checkIn.mutate(
      { id: sessionId, data: { name, pin, deviceToken } },
      {
        onSuccess: (res) => {
          if (res.success) {
            setSuccess(true);
            setCheckedInName(res.name);
          }
        },
        onError: (error: any) => {
          const msg = error?.data?.error || "Check-in failed.";
          const attempts = error?.data?.attemptsRemaining;

          if (
            msg.includes("already checked in") ||
            msg.includes("already registered") ||
            msg.includes("already checked")
          ) {
            setNetworkStatus("denied");
            setNetworkReason("Already Recorded — Your attendance has already been registered on this device.");
            return;
          }

          setCheckInError(msg);
          if (attempts !== undefined) {
            setAttemptsLeft(attempts);
          }
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
          <h1 className="text-3xl font-bold tracking-tight text-center mb-2">Verified</h1>
          <p className="text-muted-foreground text-center">
            {checkedInName}, your attendance has been securely recorded.
          </p>
          <p className="text-sm text-muted-foreground mt-8">You may now close this page.</p>
        </div>
      </ParticipantLayout>
    );
  }

  if (networkStatus === "verifying") {
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

  return (
    <ParticipantLayout>
      <div className="w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Session Check-In</h1>
          <p className="text-muted-foreground text-sm">Enter your credentials to verify attendance.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {checkInError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Verification Failed</AlertTitle>
                <AlertDescription>
                  {checkInError}
                  {attemptsLeft !== null && (
                    <span className="block mt-1 font-bold">
                      {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  data-testid="input-name"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Session PIN</label>
                <div className="flex justify-center py-2">
                  <InputOTP maxLength={4} value={pin} onChange={setPin} data-testid="input-pin">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-14 h-14 text-xl" />
                      <InputOTPSlot index={1} className="w-14 h-14 text-xl" />
                      <InputOTPSlot index={2} className="w-14 h-14 text-xl" />
                      <InputOTPSlot index={3} className="w-14 h-14 text-xl" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            </div>

            <Button
              data-testid="button-checkin"
              className="w-full h-12 text-lg font-bold"
              onClick={handleCheckIn}
              disabled={checkIn.isPending || !name || pin.length !== 4 || attemptsLeft === 0}
            >
              {checkIn.isPending ? "Verifying..." : "Verify Attendance"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ParticipantLayout>
  );
}
