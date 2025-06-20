
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Upload, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CSVUploaderProps {
  collectionId: string;
  auctionStatus: 'draft' | 'active' | 'closed';
  onSuccess: () => void;
}

interface ValidationError {
  row: number;
  field: string;
  value: string;
  error: string;
}

interface ParsedItem {
  name: string;
  description: string;
  starting_bid: number;
  inventory: number;
}

export function CSVUploader({ collectionId, auctionStatus, onSuccess }: CSVUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validItems, setValidItems] = useState<ParsedItem[]>([]);
  const [showResults, setShowResults] = useState(false);

  const parseCSV = (csvText: string): string[][] => {
    const lines = csvText.split('\n');
    const result: string[][] = [];
    
    for (const line of lines) {
      if (line.trim()) {
        const row: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          
          if (char === '"' && !inQuotes) {
            inQuotes = true;
          } else if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip next quote
          } else if (char === '"' && inQuotes) {
            inQuotes = false;
          } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        row.push(current.trim());
        result.push(row);
      }
    }
    
    return result;
  };

  const validateItem = (item: any, rowIndex: number): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Required fields
    if (!item.name || item.name.trim() === '') {
      errors.push({
        row: rowIndex,
        field: 'name',
        value: item.name || '',
        error: 'Name is required'
      });
    }

    if (!item.starting_bid) {
      errors.push({
        row: rowIndex,
        field: 'starting_bid',
        value: item.starting_bid || '',
        error: 'Starting bid is required'
      });
    } else {
      const bid = parseFloat(item.starting_bid);
      if (isNaN(bid) || bid <= 0) {
        errors.push({
          row: rowIndex,
          field: 'starting_bid',
          value: item.starting_bid,
          error: 'Starting bid must be a positive number'
        });
      }
    }

    if (!item.inventory) {
      errors.push({
        row: rowIndex,
        field: 'inventory',
        value: item.inventory || '',
        error: 'Inventory is required'
      });
    } else {
      const inventory = parseInt(item.inventory);
      if (isNaN(inventory) || inventory < 1) {
        errors.push({
          row: rowIndex,
          field: 'inventory',
          value: item.inventory,
          error: 'Inventory must be a positive integer'
        });
      }
    }

    return errors;
  };

  const processCSV = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(10);
    setValidationErrors([]);
    setValidItems([]);
    setShowResults(false);

    try {
      const text = await file.text();
      setUploadProgress(30);

      const rows = parseCSV(text);
      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const expectedHeaders = ['name', 'description', 'starting_bid', 'inventory'];
      
      // Check headers
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      setUploadProgress(50);

      const errors: ValidationError[] = [];
      const valid: ParsedItem[] = [];
      const usedNames = new Set<string>();

      // Process data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => cell.trim() === '')) continue; // Skip empty rows

        const item: any = {};
        headers.forEach((header, index) => {
          item[header] = row[index] || '';
        });

        // Validate item
        const itemErrors = validateItem(item, i + 1);
        
        // Check for duplicate names
        if (item.name && usedNames.has(item.name.toLowerCase().trim())) {
          itemErrors.push({
            row: i + 1,
            field: 'name',
            value: item.name,
            error: 'Duplicate name in this upload'
          });
        } else if (item.name) {
          usedNames.add(item.name.toLowerCase().trim());
        }

        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
        } else {
          valid.push({
            name: item.name.trim(),
            description: item.description?.trim() || '',
            starting_bid: parseFloat(item.starting_bid),
            inventory: parseInt(item.inventory)
          });
        }
      }

      setUploadProgress(70);
      setValidationErrors(errors);
      setValidItems(valid);
      setShowResults(true);

      if (errors.length === 0 && valid.length > 0) {
        // All items are valid, proceed with upload
        await uploadItems(valid);
      }

      setUploadProgress(100);
    } catch (error) {
      console.error('CSV processing error:', error);
      toast({
        title: 'Upload Error',
        description: error instanceof Error ? error.message : 'Failed to process CSV file',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const uploadItems = async (items: ParsedItem[]) => {
    try {
      const itemsToInsert = items.map((item, index) => ({
        collection_id: collectionId,
        name: item.name,
        description: item.description || null,
        starting_bid: item.starting_bid,
        inventory: item.inventory,
        sort_order: index + 1
      }));

      const { error } = await supabase
        .from('items')
        .insert(itemsToInsert);

      if (error) throw error;

      toast({
        title: 'Upload Successful!',
        description: `${items.length} items have been added to the collection.`,
      });

      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to save items to database. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadErrorReport = () => {
    if (validationErrors.length === 0) return;

    const errorData = [
      ['Row', 'Field', 'Value', 'Error'],
      ...validationErrors.map(error => [
        error.row.toString(),
        error.field,
        error.value,
        error.error
      ])
    ];

    const csvContent = errorData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation-errors.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Error Report Downloaded',
      description: 'Validation errors have been downloaded as CSV.',
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="csv-file">Upload CSV File</Label>
        <Input
          id="csv-file"
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              processCSV(file);
            }
          }}
          disabled={isUploading || auctionStatus === 'closed'}
          className="mt-1"
        />
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Upload className="w-4 h-4 animate-spin" />
            <span className="text-sm">Processing CSV...</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
        </div>
      )}

      {showResults && (
        <div className="space-y-4">
          {validItems.length > 0 && (
            <div className="p-4 border rounded-lg bg-green-50">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-800">
                  {validItems.length} valid items ready to upload
                </span>
              </div>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="p-4 border rounded-lg bg-red-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">
                    {validationErrors.length} validation errors found
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadErrorReport}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Error Report
                </Button>
              </div>
            </div>
          )}

          {validationErrors.length > 0 && validItems.length > 0 && (
            <Button
              onClick={() => uploadItems(validItems)}
              disabled={isUploading}
            >
              Upload {validItems.length} Valid Items
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
