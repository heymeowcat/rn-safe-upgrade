"use client";

import { useState, useRef } from "react";
import { Upload, FileJson, CheckCircle2, AlertCircle } from "lucide-react";
import type { PackageJson } from "@/lib/types";

interface JsonUploaderProps {
  onPackageJsonLoad: (data: PackageJson) => void;
}

export default function JsonUploader({ onPackageJsonLoad }: JsonUploaderProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validatePackageJson = (data: any): boolean => {
    if (!data || typeof data !== "object") {
      setError("Invalid JSON format");
      return false;
    }

    if (!data.dependencies && !data.devDependencies) {
      setError("No dependencies found in package.json");
      return false;
    }

    return true;
  };

  const handleTextChange = (text: string) => {
    setJsonText(text);
    setError(null);
    setSuccess(false);

    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      if (validatePackageJson(parsed)) {
        setSuccess(true);
        onPackageJsonLoad(parsed);
      }
    } catch (e) {
      setError("Invalid JSON syntax");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text);
      handleTextChange(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (file && file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setJsonText(text);
        handleTextChange(text);
      };
      reader.readAsText(file);
    } else {
      setError("Please drop a valid JSON file");
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const loadExample = () => {
    const examplePackageJson = {
      name: "my-react-native-app",
      version: "1.0.0",
      dependencies: {
        react: "^17.0.2",
        "react-native": "0.68.2",
        "@react-navigation/native": "^6.0.10",
        "react-native-screens": "^3.13.1",
        "react-native-safe-area-context": "^4.2.4",
        "react-native-gesture-handler": "^2.3.2",
      },
      devDependencies: {
        "@babel/core": "^7.12.9",
        "@babel/runtime": "^7.12.5",
        "metro-react-native-babel-preset": "^0.70.3",
      },
    };

    const text = JSON.stringify(examplePackageJson, null, 2);
    setJsonText(text);
    handleTextChange(text);
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload File
        </button>
        <button
          onClick={loadExample}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-sm transition-colors"
        >
          <FileJson className="w-4 h-4" />
          Load Example
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Textarea */}
      <div onDrop={handleDrop} onDragOver={handleDragOver} className="relative">
        <textarea
          value={jsonText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste your package.json here..."
          className="w-full h-72 p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          spellCheck={false}
        />

        {/* Status indicator */}
        {error && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg shadow-sm text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {success && !error && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-400 px-3 py-2 rounded-lg shadow-sm text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Valid JSON detected
          </div>
        )}
      </div>
    </div>
  );
}
