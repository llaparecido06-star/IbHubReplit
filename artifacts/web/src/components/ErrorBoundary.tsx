import React, { Component, type ComponentType, type PropsWithChildren } from "react";
import { ErrorFallback, type ErrorFallbackProps } from "@/components/ErrorFallback";

export type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, info: { componentStack: string }) => void;
}>;

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static defaultProps: { FallbackComponent: ComponentType<ErrorFallbackProps> } = {
    FallbackComponent: ErrorFallback,
  };

  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    if (typeof this.props.onError === "function") {
      try { this.props.onError(error, info); } catch {}
    }
    if (typeof console !== "undefined" && console.error) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render() {
    const Fallback = this.props.FallbackComponent ?? ErrorFallback;
    if (this.state.error) {
      return <Fallback error={this.state.error} resetError={this.resetError} />;
    }
    return this.props.children;
  }
}
