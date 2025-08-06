"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchCommandProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  links?: any[]; // 添加 links 属性
}

export function SearchCommand({ 
  onSearch, 
  placeholder = "Search...",
  links
}: SearchCommandProps) {
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    onSearch?.(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10"
        />
      </div>
      <Button onClick={handleSearch} variant="outline" size="sm">
        Search
      </Button>
    </div>
  );
} 