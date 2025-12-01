import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface PasswordRuleProps {
  isValid: boolean;
  text: string;
}

export const PasswordRule: React.FC<PasswordRuleProps> = ({
  isValid,
  text,
}) => {
  return (
    <li
      className={`flex items-center gap-2 ${
        isValid ? "text-green-600" : "text-gray-500"
      }`}
    >
      {isValid ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <span>{text}</span>
    </li>
  );
};
