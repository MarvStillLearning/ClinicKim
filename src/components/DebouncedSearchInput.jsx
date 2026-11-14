import { memo, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

// Keeps each keystroke local and notifies the page after a short pause.
const DebouncedSearchInput = memo(function DebouncedSearchInput({
  onSearch,
  placeholder = "Search...",
  className = "search",
  resetKey,
  inputProps = {},
}) {
  const [value, setValue] = useState("");
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    const timer = window.setTimeout(() => onSearchRef.current(value), 150);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    setValue("");
    onSearchRef.current("");
  }, [resetKey]);

  return (
    <div className={className}>
      <Search size={16} aria-hidden="true" />
      <input
        {...inputProps}
        type={inputProps.type || "search"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
});

export default DebouncedSearchInput;
