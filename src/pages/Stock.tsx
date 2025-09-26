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
import ReactSelect from 'react-select';

// Extended interface for profile with branch_context
interface ExtendedProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  position?: string;
  role: 'admin' | 'regional_manager' | 'district_manager' | 'manager' | 'assistant_manager' | 'staff';
  branch_id?: string;
  branch_context?: string;
  last_access?: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

interface StockItem {
  id: string;
  item_id: string;
  current_quantity: number;
  last_updated: string;
  items: {
    name: string;
    category: string;
    threshold_level: number;
    image_url?: string;
    branch_id: string;
  };
}

const Stock = () => {
  const { profile } = useAuth() as { profile: ExtendedProfile | null };
  const { toast } = useToast();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [quickActionItem, setQuickActionItem] = useState<StockItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'low' | 'critical'>('all');

  const fetchStockData = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select(`
          *,
          items (
            name,
            category,
            threshold_level,
            image_url,
            branch_id
          )
        `)
        .order('last_updated', { ascending: false });

      if (error) throw error;
      
      let stockData = data || [];
      
      // Filter by branch context for regional/district managers, by branch_id for others
      if ((profile?.role !== 'regional_manager' && profile?.role !== 'district_manager') && profile?.branch_id) {
        stockData = stockData.filter(item => item.items.branch_id === profile.branch_id);
      } else if ((profile?.role === 'regional_manager' || profile?.role === 'district_manager') && profile?.branch_context) {
        stockData = stockData.filter(item => item.items.branch_id === profile.branch_context);
      }
      
      setStockItems(stockData);
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

      // Check if stock alert should be sent based on the result
      if (data && data.new_quantity !== undefined) {
        await checkAndSendStockAlert(selectedItem, data.new_quantity);
      }

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

  const checkAndSendStockAlert = async (item: StockItem, newQuantity: number) => {
    const threshold = item.items.threshold_level;
    let alertType: 'low' | 'critical' | null = null;

    if (newQuantity <= threshold * 0.5) {
      alertType = 'critical';
    } else if (newQuantity <= threshold) {
      alertType = 'low';
    }

    if (alertType && profile?.phone) {
      try {
        // Check if WhatsApp notifications are enabled for the branch
        const branchId = profile.branch_id || profile.branch_context;
        if (!branchId) {
          console.log('No branch ID found, skipping stock alert');
          return;
        }

        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('notification_settings')
          .eq('id', branchId)
          .single();

        if (branchError || !branchData?.notification_settings?.whatsapp) {
          console.log('WhatsApp notifications disabled for branch, skipping stock alert');
          return;
        }

        // Prepare WhatsApp message (same format as the edge function)
        const urgencyText = alertType === 'critical' ? '🚨 CRITICAL' : '⚠️ LOW STOCK';
        const message = `${urgencyText} ALERT

📦 Item: ${item.items.name}
📊 Current: ${newQuantity} units
📋 Threshold: ${threshold} units

${alertType === 'critical' 
  ? '⚡ URGENT: Immediate restocking required!' 
  : '📈 Action needed: Please consider restocking soon.'
}

Time: ${new Date().toLocaleString()}

_Sent by_
_Sushi Yama Inventory System_`;

        console.log('Sending stock alert via WhatsApp:', {
          itemName: item.items.name,
          currentQuantity: newQuantity,
          thresholdLevel: threshold,
          alertType,
          userPhone: profile.phone,
          branchWhatsAppEnabled: branchData?.notification_settings?.whatsapp
        });

        // Use the same direct method that works in Settings
        const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
          body: {
            phoneNumber: profile.phone,
            message: message,
            type: 'whatsapp'
          }
        });

        if (error) {
          console.error('Stock alert WhatsApp failed:', error);
        } else {
          console.log('Stock alert WhatsApp sent successfully:', data);
          toast({
            title: "Stock Alert Sent",
            description: `${alertType === 'critical' ? 'Critical' : 'Low'} stock notification sent via WhatsApp`,
          });
        }
      } catch (error) {
        console.error('Error sending stock alert WhatsApp:', error);
      }
    }
  };

  const handleQuickStockAction = async (item: StockItem, action: 'in' | 'out') => {
    if (!quantity) {
      toast({
        title: "Error",
        description: "Please enter a quantity first",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('update_stock_quantity', {
        p_item_id: item.item_id,
        p_movement_type: action,
        p_quantity: parseInt(quantity),
        p_reason: `Quick ${action === 'in' ? 'stock in' : 'stock out'}`
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Stock ${action === 'in' ? 'added' : 'removed'} successfully`,
      });

      // Check if stock alert should be sent
      await checkAndSendStockAlert(item, data.new_quantity);

      fetchStockData();
      setQuantity('');
      setQuickActionItem(null);
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

  // Filter items based on critical vs low stock - mutually exclusive
  const criticalStockItems = stockItems.filter(item => 
    item.current_quantity <= item.items.threshold_level * 0.5
  );

  const lowStockItems = stockItems.filter(item => 
    item.current_quantity > item.items.threshold_level * 0.5 && 
    item.current_quantity <= item.items.threshold_level
  );
  
  // Filter items based on search term and filter type
  let displayItems = stockItems;
  
  if (filterType === 'low') {
    displayItems = lowStockItems;
  } else if (filterType === 'critical') {
    displayItems = criticalStockItems;
  }
  
  const filteredStockItems = displayItems.filter(item =>
    item.items.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.items.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Prepare options for react-select (use all items for selection)
  const selectOptions = stockItems.filter(item =>
    item.items.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.items.category.toLowerCase().includes(searchTerm.toLowerCase())
  ).map(item => ({
    value: item.id,
    label: `${item.items.name} (Current: ${item.current_quantity})`,
    item: item
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Stock Management</h1>
        <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Stock Movement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Record Stock Movement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Item</Label>
                <ReactSelect
                  options={selectOptions}
                  placeholder="Search and select an item..."
                  isSearchable={true}
                  isClearable={true}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  onChange={(selectedOption) => {
                    if (selectedOption) {
                      setSelectedItem(selectedOption.item);
                    } else {
                      setSelectedItem(null);
                    }
                  }}
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      minHeight: '40px',
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      zIndex: 50,
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused ? 'hsl(var(--muted))' : 'hsl(var(--background))',
                      color: 'hsl(var(--foreground))',
                      cursor: 'pointer',
                    }),
                  }}
                />
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
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilterType('all')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockItems.length}</div>
            <p className="text-xs text-muted-foreground">Items in inventory</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilterType('low')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Need restocking</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilterType('critical')}>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>
              {filterType === 'all' ? 'Current Stock Levels' :
               filterType === 'low' ? 'Low Stock Items' :
               'Critical Stock Items'}
            </CardTitle>
          </div>
          <div className="mt-4">
            <Input
              placeholder="Search for items by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredStockItems.map((item) => {
              const status = getStockStatus(item);
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    {item.items.image_url ? (
                      <img 
                        src={item.items.image_url} 
                        alt={item.items.name}
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{item.items.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {item.items.category}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center justify-between sm:justify-start gap-4">
                      <div className="text-right">
                        <p className="font-medium">Qty: {item.current_quantity}</p>
                        <p className="text-xs text-muted-foreground">
                          Threshold: {item.items.threshold_level}
                        </p>
                      </div>
                      
                      <Badge variant={status.color as any}>
                        {status.status}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-end">
                      {quickActionItem?.id === item.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-16 h-8 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickStockAction(item, 'in')}
                            className="h-8 px-2"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickStockAction(item, 'out')}
                            className="h-8 px-2"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setQuickActionItem(null);
                              setQuantity('');
                            }}
                            className="h-8 px-2"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setQuickActionItem(item);
                              setQuantity('');
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredStockItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {filterType === 'all' ? 'No stock items found. Add some items first.' :
                 filterType === 'low' ? 'No low stock items found.' :
                 'No critical stock items found.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Stock;