import React from 'react';

type NumericTextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: string;
  onValueChange: (value: string) => void;
  maxDecimals?: number;
};

/** Text input that accepts only digits and an optional decimal point. */
export const NumericTextInput: React.FC<NumericTextInputProps> = ({
  value,
  onValueChange,
  maxDecimals = 2,
  ...inputProps
}) => {
  const pattern = maxDecimals > 0
    ? new RegExp(`^\\d*(?:\\.\\d{0,${maxDecimals}})?$`)
    : /^\d*$/;

  return (
    <input
      {...inputProps}
      type="text"
      inputMode={maxDecimals > 0 ? 'decimal' : 'numeric'}
      value={value}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (pattern.test(nextValue)) onValueChange(nextValue);
      }}
    />
  );
};
