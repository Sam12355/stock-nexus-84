import { useState, useEffect, useRef } from 'react';
import { Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SearchItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  current_quantity: number;
  threshold_level: number;
}

export function SearchDropdown() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchItems();
      setIsOpen(true);
    } else {
      setSearchResults([]);
      setIsOpen(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchItems = async () => {
    if (!profile || searchTerm.length < 2) return;

    try {
      const branchId = profile.branch_id || profile.branch_context;
      
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          name,
          category,
          description,
          threshold_level,
          stock (
            current_quantity
          )
        `)
        .eq('branch_id', branchId)
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (error) throw error;

      const items = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        threshold_level: item.threshold_level,
        current_quantity: item.stock?.[0]?.current_quantity || 0
      }));

      setSearchResults(items);
    } catch (error) {
      console.error('Error searching items:', error);
      setSearchResults([]);
    }
  };

  const handleItemClick = (item: SearchItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getStockStatus = (current: number, threshold: number) => {
    if (current <= threshold * 0.5) return { status: 'Critical', variant: 'destructive' as const };
    if (current <= threshold) return { status: 'Low', variant: 'secondary' as const };
    return { status: 'Adequate', variant: 'default' as const };
  };

  return (
    <>
      <div className="relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            className="pl-9 w-64 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
          />
        </div>

        {isOpen && searchResults.length > 0 && (
          <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-hidden">
            <CardContent className="p-0">
              {searchResults.map((item) => {
                const stockInfo = getStockStatus(item.current_quantity, item.threshold_level);
                return (
                  <div
                    key={item.id}
                    className="flex items-center space-x-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    onClick={() => handleItemClick(item)}
                  >
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Qty: {item.current_quantity}</p>
                      <Badge variant={stockInfo.variant} className="text-xs">
                        {stockInfo.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedItem.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">{selectedItem.category}</p>
              </div>
              
              {selectedItem.description && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Current Stock</h4>
                  <p className="text-lg font-bold">{selectedItem.current_quantity}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Threshold</h4>
                  <p className="text-lg font-bold">{selectedItem.threshold_level}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Stock Status</h4>
                <Badge variant={getStockStatus(selectedItem.current_quantity, selectedItem.threshold_level).variant}>
                  {getStockStatus(selectedItem.current_quantity, selectedItem.threshold_level).status}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}