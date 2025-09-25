import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Package, TrendingUp, AlertTriangle, Plus, Minus, Eye } from "lucide-react";

interface StockItem {
  id: string;
  item_id: string;
  current_quantity: number;
  last_updated: string;
  items: {
    name: string;
    category: string;
    threshold_level: number;
  };
}

const Stock = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);

  const fetchStockData = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select(`
          *,
          items (
            name,
            category,
            threshold_level
          )
        `)
        .order('last_updated', { ascending: false });

      if (error) throw error;
      setStockItems(data || []);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      toast({
        title: "Error",
        description: "Failed to load stock data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStockMovement = async () => {
    if (!selectedItem || !quantity) return;

    try {
      const { data, error } = await supabase.rpc('update_stock_quantity', {
        p_item_id: selectedItem.item_id,
        p_movement_type: movementType,
        p_quantity: parseInt(quantity),
        p_reason: reason || null
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Stock ${movementType === 'in' ? 'added' : 'removed'} successfully`,
      });

      // Refresh stock data
      fetchStockData();
      
      // Reset form and close dialog
      setSelectedItem(null);
      setQuantity('');
      setReason('');
      setMovementType('in');
      setIsMovementDialogOpen(false);
      setSearchTerm('');
    } catch (error) {
      console.error('Error updating stock:', error);
      const errMsg = (error as any)?.message || "Failed to update stock";
      toast({
        title: "Error",
        description: errMsg,
        variant: "destructive",
      });
    }
  };

  const getStockStatus = (item: StockItem) => {
    const threshold = item.items.threshold_level;
    const current = item.current_quantity;
    
    if (current <= threshold * 0.5) return { status: 'critical', color: 'destructive' };
    if (current <= threshold) return { status: 'low', color: 'default' };
    return { status: 'adequate', color: 'secondary' };
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading stock data...</div>;
  }

  const lowStockItems = stockItems.filter(item => 
    item.current_quantity <= item.items.threshold_level
  );
  // Filter items based on search term
  const filteredStockItems = stockItems.filter(item =>
    item.items.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.items.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const criticalStockItems = stockItems.filter(item => 
    item.current_quantity <= item.items.threshold_level * 0.5
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Stock Management</h1>
        <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Stock Movement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Stock Movement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Item</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                  <Select onValueChange={(value) => {
                    const item = stockItems.find(s => s.id === value);
                    setSelectedItem(item || null);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an item" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {filteredStockItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.items.name} (Current: {item.current_quantity})
                        </SelectItem>
                      ))}
                      {filteredStockItems.length === 0 && (
                        <div className="px-2 py-1 text-sm text-muted-foreground">
                          No items found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {selectedItem && (
                <>
                  <div>
                    <Label>Movement Type</Label>
                    <Select onValueChange={(value: 'in' | 'out') => setMovementType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="in">Stock In</SelectItem>
                        <SelectItem value="out">Stock Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity"
                    />
                  </div>
                  
                  <div>
                    <Label>Reason (Optional)</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Enter reason for stock movement"
                    />
                  </div>
                  
                  <Button onClick={handleStockMovement} className="w-full">
                    Record Movement
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockItems.length}</div>
            <p className="text-xs text-muted-foreground">Items in inventory</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Need restocking</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Urgent attention needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Stock Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stockItems.map((item) => {
              const status = getStockStatus(item);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium">{item.items.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {item.items.category}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-medium">Qty: {item.current_quantity}</p>
                      <p className="text-xs text-muted-foreground">
                        Threshold: {item.items.threshold_level}
                      </p>
                    </div>
                    
                    <Badge variant={status.color as any}>
                      {status.status}
                    </Badge>
                    
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedItem(item);
                          setMovementType('in');
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedItem(item);
                          setMovementType('out');
                        }}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {stockItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No stock items found. Add some items first.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Stock;