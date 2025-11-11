/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Input, Alert } from "../ui";
import { Lock, Mail, User } from "lucide-react";
import {
  validatePassword,
  isPasswordStrong,
} from "../../utils/validatepassword";

import { PasswordRule } from "../ui/PasswordRule";

export const RegisterForm: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const passwordRules = validatePassword(password);
  const passwordValid = isPasswordStrong(passwordRules);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!passwordValid) {
      setError("Your password must meet all the security conditions.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      await register({ name, email, password });
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert type="error" message={error} />}

      <Alert
        type="info"
        message="Your password will be used to encrypt all your files. Make sure to use a strong password and remember it!"
      />

      <div className="space-y-4">
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="pl-10"
          />
        </div>

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="pl-10"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="password"
            placeholder="Password (min 10 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="pl-10"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="pl-10"
          />
        </div>

        {/* Validation visuelle */}
        {password && (
          <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1 border">
            <p className="font-medium text-gray-700 mb-1">
              Password must include:
            </p>
            <ul className="space-y-1">
              <PasswordRule
                isValid={passwordRules.length}
                text="At least 10 characters"
              />
              <PasswordRule
                isValid={passwordRules.uppercase}
                text="One uppercase letter (A–Z)"
              />
              <PasswordRule
                isValid={passwordRules.number}
                text="One number (0–9)"
              />
              <PasswordRule
                isValid={passwordRules.special}
                text="One special character (!@#$%^&*)"
              />
            </ul>
          </div>
        )}
      </div>

      <Button type="submit" fullWidth isLoading={isLoading}>
        Create Account
      </Button>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <a
          href="/login"
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Sign in
        </a>
      </p>
    </form>
  );
};
