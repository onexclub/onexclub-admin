"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

const Form = FormProvider;

type FormFieldContextValue<TName extends FieldPath<FieldValues>> = {
  name: TName;
};

const FormFieldContext = React.createContext({} as FormFieldContextValue<FieldPath<FieldValues>>);

function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({
  ...props
}: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const { name } = React.useContext(FormFieldContext);
  const form = useFormContext();
  const { error } = form.getFieldState(name, form.formState);
  return {
    name,
    id: `field-${String(name)}`,
    error,
  };
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
));
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  HTMLLabelElement,
  Omit<React.ComponentPropsWithoutRef<typeof Label>, "htmlFor">
>(({ className, ...props }, ref) => {
  const { error, id } = useFormField();
  return <Label ref={ref} htmlFor={id} className={cn(error?.message ? "text-rose-600 dark:text-rose-400" : "", className)} {...props} />;
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(
  ({ ...props }, ref) => {
    const { error, id } = useFormField();
    return (
      <Slot
        ref={ref}
        id={id}
        aria-invalid={!!error?.message}
        aria-describedby={error?.message ? `${id}-message` : undefined}
        {...props}
      />
    );
  },
);
FormControl.displayName = "FormControl";

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, id } = useFormField();
    const body = error?.message ? String(error.message) : children;
    if (!body) return null;
    return (
      <p ref={ref} id={`${id}-message`} className={cn("text-[13px] font-medium text-rose-600 dark:text-rose-400", className)} {...props}>
        {body}
      </p>
    );
  },
);
FormMessage.displayName = "FormMessage";

export { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, useFormField };
