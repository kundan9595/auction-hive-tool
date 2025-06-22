
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Upload, X, Image } from 'lucide-react';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageChange: (imageUrl: string | null) => void;
  disabled?: boolean;
}

export function ImageUpload({ currentImageUrl, onImageChange, disabled }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      onImageChange(data.publicUrl);

      toast({
        title: 'Image Uploaded',
        description: 'Item image has been uploaded successfully.',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (currentImageUrl) {
      try {
        // Extract file path from URL
        const url = new URL(currentImageUrl);
        const filePath = url.pathname.split('/').pop();
        
        if (filePath) {
          await supabase.storage
            .from('item-images')
            .remove([filePath]);
        }
      } catch (error) {
        console.error('Error removing image:', error);
      }
    }
    
    onImageChange(null);
    toast({
      title: 'Image Removed',
      description: 'Item image has been removed.',
    });
  };

  return (
    <div className="space-y-4">
      <Label>Item Image (Optional)</Label>
      
      {currentImageUrl ? (
        <div className="space-y-2">
          <div className="relative inline-block">
            <img
              src={currentImageUrl}
              alt="Item preview"
              className="w-32 h-32 object-cover rounded-lg border"
            />
            {!disabled && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                onClick={removeImage}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">No image uploaded</p>
        </div>
      )}

      {!disabled && (
        <div>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadImage(file);
              }
            }}
            disabled={uploading}
            className="hidden"
            id="image-upload"
          />
          <Label htmlFor="image-upload" className="cursor-pointer">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              className="w-full"
              asChild
            >
              <span>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : currentImageUrl ? 'Change Image' : 'Upload Image'}
              </span>
            </Button>
          </Label>
        </div>
      )}
    </div>
  );
}
