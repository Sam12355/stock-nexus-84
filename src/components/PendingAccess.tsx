import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock } from "lucide-react";

export function PendingAccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Clock className="h-12 w-12 text-orange-500" />
          </div>
          <CardTitle className="text-xl font-semibold">Access Pending</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Your account has been created successfully, but access is pending approval.
            </p>
            <div className="flex items-center justify-center gap-2 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Waiting for administrator to assign your role and branch
              </span>
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg text-left space-y-2">
            <h4 className="font-medium text-sm">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Administrator will review your account</li>
              <li>• You will be assigned a role and branch</li>
              <li>• You'll receive access to the system</li>
            </ul>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Please contact your administrator if you have any questions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}