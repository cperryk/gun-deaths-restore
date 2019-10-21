$(function(){
	var SERVER_ROOT = 'http://slate-interactives-prod.elasticbeanstalk.com/gun-deaths/';
	var GET_VICTIMS_URL = 'snapshot.json';
	var GET_MAP_DATA_URL = SERVER_ROOT+'getMapData.php?callback=?';
	var INCIDENTS_PER_ROW = 40;
	var ACTIVE_MAKER_STYLE = {color:'#ED1F24',fillOpacity:1};
	var HOVER_MARKER_STYLE = {color:'#300018',fillOpacity:1};
	var INACTIVE_MARKER_STYLE = {color:'#660033',fillOpacity:0.7};
	var MAP_ID = 'map-54m1dlce';

	const VICTIMS = window.victims;
	const LOCATIONS = window.gunDeathsLocations;

	L.TileLayer.Common = L.TileLayer.extend({
		initialize: function (options) {
			L.TileLayer.prototype.initialize.call(this, this.url, options);
		}
	});
	L.TileLayer.MapBox = L.TileLayer.Common.extend({
		url: 'http://{s}.tiles.mapbox.com/v3/{user}.{map}/{z}/{x}/{y}.png'
	});

	VICTIMS.forEach((victim) => {
		victim.dateObj = parseYYYYMMDD(victim.date);
		victim.cityLowercase = victim.city.toLowerCase();
		victim.stateLowercase = victim.state.toLowerCase();
	});

	function Interactive(){
		this.map = new DeathsMap(this);
		this.criteria = {};
		this.victims_container = $('#victims');
		this.victims_wrapper = $('#victims_wrapper');
		this.dataHandler = new DataHandler(this);
		this
			.updateIncidents()
			.addEventListeners()
			.addCriteriaListeners();
		this.tooltip = new Tooltip($('#tooltip'), this);
	}
	Interactive.prototype.clearIncidents = function(){
		this.victims_container.empty();
		return this;
	};
	Interactive.prototype.updateIncidents = function(){
		$('#count_here').html('');
		var self = this;
		this
			.clearIncidents()
			.loadingSignal(true)
			.dataHandler
				.getVictimsData(this.criteria, function(data){
					self
						.printIncidents(data)
						.loadingSignal(false);
		});
		return self;
	};
	Interactive.prototype.printIncidents = function(incidents){
		this.clearIncidents();
		this.victims_container.detach();
		var last_printed_data = '2012-12-14';
		var last_printed_phase = 0;
		var incidents_not_newtown = 0;
		var newtown_marker_printed = false;
		var l = incidents.length;
		for(var i=0;i<l;i+=INCIDENTS_PER_ROW){
			var victims_row = $('<div class="victim_row">');
			for(var a=0;a<INCIDENTS_PER_ROW&&(a+i)<l;a++){
				var incident = new Incident(incidents[i+a],last_printed_data,last_printed_phase,victims_row,a);
				if(last_printed_data!==incident.prop.date){
					incident.printDateMarker(a);
				}
				else if(!newtown_marker_printed&&incident.prop.isNewtown==='1'){
					incident.printDateMarker(a,true);
					newtown_marker_printed = true;
				}
				last_printed_data = incident.prop.date;
				last_printed_phase = incident.phase;
				if(incident.prop.isNewtown === false){
					incidents_not_newtown++;
				}
			}
			$('<div class="meterCount">')
				.html(commaSeparateNumber(i+a))
				.appendTo(victims_row);
			victims_row.appendTo(this.victims_container);
		}
		this.victims_container.appendTo(this.victims_wrapper);
		$('#count_here').html(commaSeparateNumber(incidents_not_newtown));
		return this;
	};
	Interactive.prototype.addEventListeners = function(){
		var self = this;
		this.victims_container.on('click','.victim',incidentClicked);
		$('#btn_methodology').click(showMethodology);

		function incidentClicked(){
			if(self.activeVictimObj){
				self.activeVictimObj.removeClass('active');
			}
			self.activeVictimObj = $(this)
				.addClass('active');
			var victimID = self.activeVictimObj.data('victimid');
			if(self.activeVictim==victimID){
				delete self.activeVictim;
				self.activeVictimObj.removeClass('active');
				self.tooltip.closeTooltip();
			}
			else{
				self.tooltip.closeTooltip();
				self.activeVictim = victimID;
				self.tooltip.positionIt(self.activeVictimObj);
				var request = self.dataHandler.getDataOnVictim(victimID,function(data){
					self.tooltip.printData(data);
				});
			}
		}

		function showMethodology(){
			$('#methodology')
				.show();
		}
		return this;
	};
	Interactive.prototype.loadingSignal = function(on){
		if(on){$('#loading').show();}else{$('#loading').hide();}
		return this;
	};
	Interactive.prototype.clearCriteria = function(){
		this.emptyFilter('ageGroup')
			.emptyFilter('gender')
			.emptyFilter('location')
			.emptyFilter('date');
		$('#btn_ex').hide();
		if(this.criteria!==undefined){
			for(var i in this.criteria){
				delete this.criteria[i];
			}
		}
		return this;
	};
	Interactive.prototype.emptyFilter = function(criterion){
		var obj = $('#filter_'+criterion);
		var first_item = obj.find('li:first');
		if(first_item.hasClass('standard')){
			obj.find('.filterHead a')
				.html(first_item.html());
			obj.find('.active')
				.removeClass('active');
		}
		else{
			if(criterion=='location'){
				obj.find('.filterHead a')
					.html('Any Location');
			}
			else if(criterion=='date'){
				obj.find('.filterHead a')
					.html('Any Date');
			}
		}
		return this;
	};
	function fullWidthElement(conf){
		function sizeMap(){
			conf.ele
				.css({
					'width':$(window).width(),
					'position':'static'
				});
			if(conf.stretchHeight){
				conf.ele.css({'height':$(window).height()*0.9});
			}
			conf.ele
				.css({
					'position':'relative',
					'left':conf.ele.offset().left*-1
				});
			if(conf.callback){conf.callback();}
		}
		$(window).resize(function(){
			sizeMap();
		});
		sizeMap();
	}
	
	function Tooltip(obj,parent){
		this.obj = obj;
		this.par = parent;
		this.branch = this.obj.find('#branch');
		this.floater = this.obj.find('#floater');
		this.arrow = this.obj.find('#arrow');
		this.textArea = this.floater.find('#textArea');
		this.loadingTooltip = this.textArea.find('#loadingTooltip');
		this.tooltipData = this.textArea.find('#tooltipData');
		this.mapContainer = $('miniMap');
		this.makeMap();
	}
	Tooltip.prototype.positionIt = function(victim_obj){
		var victims_row = victim_obj.parent();
		this.obj
			.insertAfter(victims_row)
			.show();
		this.branch
			.show();
		this.floater
			.css({
				'left':Math.max(0,Math.min((victim_obj.position().left + victim_obj.width()/2)-this.floater.width()/2,1012-this.floater.width()))
			});
		this.arrow
			.css({
				'left':victim_obj.position().left+5
			});
		this.tooltipData.hide();
		this.loadingTooltip.show();
	};
	Tooltip.prototype.printData = function(data){
		this.mapContainer.show();
		// this.setMiniMap(data);
		var self = this;
		if(data.name===''){
			$('#tooltip_name').hide();
		}
		else{
			$('#name_here')
				.html(data.name);
			$('#tooltip_name')
				.show();
		}
		if(data.age===null){
			$('#tooltip_age').hide();
		}
		else{
			$('#age_here')
				.html(data.age);
			$('#tooltip_age')
				.show();
		}
		$('#location_here')
			.html(data.city+', '+data.state)
			.unbind()
			.click(setLocation);
		$('#date_here')
			.html(yyyymmdd_to_mmddyyyy(data.date,true))
			.unbind()
			.click(setDate);
		$('#source_here')
			.attr('href',data.url)
			.html(retrieveDomain(data.url));
		$('#btn_reportError')
			.attr('href','mailto:slatedata@gmail.com?subject=Info on Incident #'+this.par.activeVictimObj.data('victimid')+', '+yyyymmdd_to_mmddyyyy(data.date,true)+', '+data.city);
		var cats_obj = $('#victim_cats').empty();
		var cats = getSortedArray(data.categorizations,true);
		if(cats.length>0){
			var PREFIX = {
				'accident':' described this an accident.',
				'suicide':' described this as a suicide.',
				'murder':' described this as a murder.',
				'police':' described this person as shot dead by law enforcement.',
				'defense':' described this person as shot dead in self-defense.',
				'other':' classified this death as "other."',
				'broken':' reported a broken link.'
			};
			for (var i = 0; i < cats.length; i++) {
				var cat = cats[i][0];
				var count = cats[i][1];
				$('<p>')
					.html(count + ' reader'+(count>1?'s':'') + PREFIX[cat])
					.appendTo(cats_obj);
			}
			cats_obj.show();
		}
		else{
			cats_obj.hide();
		}
		this.tooltipData.show();
		this.loadingTooltip.hide();
		$('#floater')
			.css('height',$('#textArea').outerHeight());
		$('#branch')
			.css('height',$('#floater').outerHeight()+$('#arrow').outerHeight());
		$('#btn_categorize_incident')
			.attr('href',SERVER_ROOT+'categorization/index.php?victimID='+data.victimID);
		function setLocation(){
			var par = self.par;
			par.clearCriteria();
			par.criteria.city = data.city;
			par.criteria.state = data.state;
			$('#btn_location a').html(data.city+', '+data.state);
			$('#icity').val(data.city);
			$('#istate').val(data.state);
			$('#btn_ex').show();
			par.updateIncidents();
		}
		function setDate(){
			var par = self.par;
			par.clearCriteria();
			par.criteria['date'] = data.date;
			$('#btn_date a').html(yyyymmdd_to_mmddyyyy(data.date,true));
			$('#imindate,#imaxdate').val(yyyymmdd_to_mmddyyyy(data.date,true));
			par.updateIncidents();
		}
		function getSortedArray(obj,desc){
			//converts a dictionary into a true array, sorting the items by the dictionary values
			var tuples = [];
			for(var key in obj){
				tuples.push([key, obj[key]]);
			}
			tuples.sort(function(a, b) {
				a = a[1];
				b = b[1];
				if(desc){
					return a < b ? -1 : (a < b ? 1 : 0);
				}
				return a > b ? -1 : (a < b ? 1 : 0);
			});
			return tuples;
		}
	};
	Tooltip.prototype.closeTooltip = function(){
		this.obj.hide();
		this.mapContainer.hide();
		if(this.marker){
			this.m.removeLayer(this.marker);
		}
	};
	Tooltip.prototype.openTooltip = function(){
		this.obj.show();
	};
	Tooltip.prototype.makeMap = function(){
		this.m = new L.Map('miniMap',{
			scrollWheelZoom:false,
			zoomControl:false,
			attributionControl:false,
			zoomAnimation:false
		})
		.addLayer(new L.TileLayer.MapBox({user:'slate',map:MAP_ID}));
	};
	Tooltip.prototype.setMiniMap = function(data){
		this.marker = new L.Marker([data.lat,data.lng]);
		this.m
			.addLayer(this.marker)
			.setView(new L.LatLng(data.lat,adjustLng(data.lng,this.floater.width()*0.25,4)),4,{animate:false});
	};

	function Incident(incident_data,lastDate,lastPhase,victims_row,index_in_row){
		this.row = victims_row;
		this.prop = {
			victimID:incident_data.victimID,
			ageGroup:incident_data.ageGroup,
			gender:incident_data.gender,
			date:incident_data.date,
			isNewtown:incident_data.isNewtown
		};
		this.phase = (lastDate==this.prop.date)?(lastPhase):(lastPhase?0:1);
		this.index_in_row = index_in_row;
		this.printIcon();
	}
	Incident.prototype.printIcon = function(){
		this.obj = $('<div>')
			.addClass('victim')
			.addClass(this.phase?'even':'odd')
			.attr('data-victimid',this.prop.victimID)
			.attr('id','victim'+this.prop.victimID)
			.data('index',this.prop.victimID);
		if(this.index_in_row===0){
			this.obj.addClass('leftmost');
		}
		if(this.prop.ageGroup!==null){
			this.obj.addClass('age'+this.prop.ageGroup);
		}
		if(this.prop.gender!==null){
			this.obj.addClass(this.prop.gender=='F'?'female':'male');
		}
		if(this.prop.isNewtown==='1'){
			this.obj.addClass('newtown');
		}
		this.obj
			.appendTo(this.row);
	};
	Incident.prototype.printDateMarker = function(a,newtown){
		var date = yyyymmdd_to_mmddyyyy(this.prop.date);
		$('<div class="row_date">')
			.addClass(newtown?'newtown':this.phase?'even':'odd')
			.html(newtown?'Newtown':date)
			.css('left',a*25)
			.appendTo(this.row);
	};
	/*
	Incident.prototype.printNewtownMarker = function(){
		$('<div class="row_date">')
			.addClass('newtown')
			.html('Newtown')
			.css('left',this.index_in_row===0?this.obj.position().left:this.obj.position().left-1)
			.appendTo(this.row);
	};*/
	function yyyymmdd_to_mmddyyyy(dateString,includeYear){
		var date = dateString.split('-');
		if(date[1][0]=='0'){date[1]=date[1][1];}
		if(date[2][0]=='0'){date[2]=date[2][1];}
		var outDate = date[1]+'/'+date[2];
		if(includeYear){
			outDate+='/'+date[0];
		}
		return outDate;
	}



	function DeathsMap(parent){
		this.par = parent;
		this.markersPrinted = [];
		var self = this;
		this.makeMap(function(){
			fullWidthElement({
				ele:$('#mapContainer'),
				stretchHeight:false,
				callback:function(){
					self.m.invalidateSize();
				}
			});
			self.getData(function(mapData){
				self.printMarkers(mapData);
			});
		});
	}
	DeathsMap.prototype.getData = function(callback){
		callback(LOCATIONS);
	};
	DeathsMap.prototype.printMarkers = function(mapData){
		var self = this;
		for(var i=mapData.length-1;i>-1;i--){
			var data = mapData[i];
			var radius = Math.max(3,Math.sqrt(data.count*10/Math.PI));
			if(data.lat!==null&&data.lng!==null){
				var marker = new L.CircleMarker([data.lat,data.lng],{weight:1,color:'#660033',fillOpacity:0.7,radius:radius})
					.addTo(this.m)
					.on('click',markerClick)
					.on('mouseover',markerOver)
					.on('mouseout',markerOut);
					marker.city = data.city;
					marker.state = data.state;
			}
		}
		function markerClick(){
			if(self.activeMarker){
				self.activeMarker.setStyle(INACTIVE_MARKER_STYLE);
			}
			if(self.activeMarker==this){
				self.activeMarker.setStyle(INACTIVE_MARKER_STYLE);
				delete self.activeMarker;
				delete self.par.criteria.city;
				delete self.par.criteria.state;
				this.active = false;
				self.par.updateIncidents();
				self.par.emptyFilter('location');
			}
			else{
				delete self.par.criteria['lat'];
				delete self.par.criteria['lng'];
				delete self.par.criteria['city'];
				delete self.par.criteria['state'];
				$('#icity').val(this.city);
				$('#istate').val(this.state);
				$('#btn_location a').html(this.city+', '+this.state);
				self.activeMarker  = this;
				this.active = true;
				this.setStyle(ACTIVE_MAKER_STYLE);
				self.par.criteria.city = this.city;
				self.par.criteria.state = this.state;
				self.par.updateIncidents();
			}
		}
		function markerOver(){
			if(!this.active){
				this.setStyle(HOVER_MARKER_STYLE);
			}
		}
		function markerOut(){
			if(!this.active){
				this.setStyle(INACTIVE_MARKER_STYLE);
			}
		}
	};
	DeathsMap.prototype.makeMap = function(callback){
		var self = this;
		self.m = new L.Map('mapContainer',{
						scrollWheelZoom:false,
						zoomControl:false,
						attributionControl:false
					})
			.setView(new L.LatLng(38, -95), 4)
			.addControl(new L.Control.Zoom({position:'topright'}))
			.addLayer(new L.TileLayer.MapBox({user:'slate',map:MAP_ID}));
		if(callback){callback();}
	};


	function DataHandler(parent){
		this.par = parent;
	}
	DataHandler.prototype.getVictimsData = function(criteria,callback){
		if (!criteria) callback(VICTIMS);

		const criteriaFncs = [];

		if (criteria.ageGroup) {
			criteriaFncs.push(victim => victim.ageGroup === criteria.ageGroup);
		}
		if (criteria.gender) {
			criteriaFncs.push(victim => victim.gender === criteria.gender);
		}
		if (criteria.minDate) {
			const parsed = parseDate(criteria.minDate);
			criteriaFncs.push(victim => victim.dateObj >= parsed);
		}

		if (criteria.city) {
			const formattedCity = criteria.city.toLowerCase().trim();
			criteriaFncs.push(victim => victim.cityLowercase === formattedCity);
		}

		if (criteria.state) {
			const formattedState = criteria.state.toLowerCase().trim();
			criteriaFncs.push(victim => victim.stateLowercase === formattedState	);
		}

		if (criteria.maxDate) {
			const parsed = parseDate(criteria.maxDate);
			parsed.setHours(23);
			parsed.setMinutes(59);
			criteriaFncs.push(victim => victim.dateObj <= parsed);
		}

		console.log(criteria);

		callback(VICTIMS.filter((victim) => criteriaFncs.every(fnc => fnc(victim))));
	};
	DataHandler.prototype.getDataOnVictim = function(victimID,callback){
		callback(VICTIMS.find((victim => victim.victimID === victimID)));
	};
	DataHandler.prototype.makeRequest = function(URL,callback){
		URL+='&callback=?';
		$.ajax({
			dataType:'json',
			url:URL,
			success:function(data){
				callback(data);
			},
			error:function(){
				alert('problem');
			}
		});
	};
	DataHandler.prototype.getCriteriaQueries = function(criteria){
		var s = '';
		for(var i in criteria){
			s+='&'+i+'='+criteria[i];
		}
		return s;
	};

	Interactive.prototype.addCriteriaListeners = function(){
		this.criteria = {};
		var self = this;
		$('#filters')
			.on('click','.filterHead',function(){
				var property = $(this).data('property');
				var filterHead = $(this);
				var filterBox = $(this).siblings('.filterBox');
				if(filterBox.css('display')=='block'){
					filterBox.hide();
				}
				else{
					$('.filterBox').hide();
					filterBox
						.css({
							'left':filterHead.position().left,
							'top':filterHead.position().top+25
						})
						.show();
				}
			})
			.on('click','li',function(){
				var filterGroup = $(this).closest('.filterGroup');
				if($(this).hasClass('standard')){
					$(this)
						.siblings()
							.removeClass('active')
							.end()
						.addClass('active');
					filterGroup
						.find('.filterHead a')
							.html($(this).html())
							.end()
						.find('.filterBox')
							.hide();
					var property = filterGroup.data('property');
					var value = $(this).data('value');
					if(value===null){
						delete self.criteria[property];
					}
					else{
						self.criteria[property] = value;
					}
					self.updateIncidents();
				}
				else if($(this).hasClass('btnok')){
					var labelString = '';
					if($(this).hasClass('locative')){
						var city = $('#icity').val();
						var state = $('#istate').val();
						if(city===''&&state===''){
							labelString='Any Location';
							removeLocationFilter();
						}
						if(city!==''){
							self.criteria['city']=city;
							labelString+=city;
							if(state!==''){
								labelString+=', ';
							}
							removeActiveMapMarker();
						}
						else{
							delete self.criteria['city'];
						}
						if(state!==''){
							self.criteria['state']=state;
							labelString+=state;
							removeActiveMapMarker();
						}
						else{
							delete self.criteria['state'];
						}
						if(city!==''||state!==''){
							$('#btn_ex_location')
								.show()
								.unbind()
								.click(function(){
									removeLocationFilter();
								});
						}
					}
					else if($(this).hasClass('date')){
						delete self.criteria['minDate'];
						delete self.criteria['maxDate'];
						var minDate = $('#imindate').val();
						var maxDate = $('#imaxdate').val();
						if(minDate!==''&&minDate==maxDate){
							labelString=minDate;
						}
						else if(minDate===''&&maxDate!==''){
							labelString='<= '+maxDate;
						}
						else if(minDate!==''&&maxDate===''){
							labelString='>= '+minDate;
						}
						else if(minDate===''&&maxDate===''){
							labelString='Any Date';
							delete self.criteria['minDate'];
							delete self.criteria['maxDate'];
							delete self.criteria['date'];
						}
						else{
							labelString=minDate+' &#8211; '+maxDate;
						}
						if(minDate!==''){
							minDate = new Date(minDate);
							self.criteria['minDate']=(minDate.getMonth()+1)+'/'+minDate.getDate()+'/'+minDate.getFullYear();
						}
						if(maxDate!==''){
							maxDate = new Date(maxDate);
							self.criteria['maxDate']=(maxDate.getMonth()+1)+'/'+maxDate.getDate()+'/'+maxDate.getFullYear();
						}
						/*
						$('#btn_ex_date')
							.show()
							.unbind()
							.click(function(){
								delete self.criteria['minDate'];
								delete self.criteria['maxDate'];
								self.emptyFilter('date');
							});
						*/
					}
					else if($(this).hasClass('keyword')){
						var keyword = $('#ikeyword').val();
						if(keyword===''){
							delete self.criteria['keyword'];
							labelString = 'No Keywords';
						}
						else{
							keyword.replace(/, /g,' ');
							labelString = keyword;
							self.criteria['keyword'] = keyword;
						}
					}
					filterGroup
						.find('.filterHead')
							.find('a')
								.html(labelString)
								.end()
							.end()
						.find('.filterBox')
							.hide();
					self.updateIncidents();
				}
			});
		$('#istate').blur(function(){
			var state = $(this).val();
			if(state.length>2){
				if(checkState(state,'name')){
					$(this).val(convert_state(state,'abbrev'));
				}
				else{
					$(this).val('');
				}
			}
			else{
				if(!checkState(state,'abbrev')){
					$(this).val('');
				}
			}
		});
		$('#imindate,#imaxdate').change(function(){
			var date = parseDate($(this).val());
			if(date){
				$(this).val((date.getMonth()+1)+'/'+date.getDate()+'/'+date.getFullYear().toString());
				var minDate = parseDate($('#imindate').val());
				var maxDate = parseDate($('#imaxdate').val());
				if($('#imaxdate').val()===''||maxDate<minDate){
					$('#imaxdate').val($('#imindate').val());
				}
			}
			else{
				$(this).val('');
			}
		});

		function removeLocationFilter(){
			delete self.criteria['city'];
			delete self.criteria['state'];
			delete self.criteria['lat'];
			delete self.criteria['lng'];
			self.emptyFilter('location');
			removeActiveMapMarker();
			self.updateIncidents();
		}
		function removeActiveMapMarker(){
			delete self.criteria['lat'];
			delete self.criteria['lng'];
			if(self.map.activeMarker){
				self.map.activeMarker.setStyle(INACTIVE_MARKER_STYLE);
				delete self.map.activeMarker;
			}
		}
	};
	var states = [
		{'name':'Alabama', 'abbrev':'AL'},
		{'name':'Alaska', 'abbrev':'AK'},
		{'name':'Arizona', 'abbrev':'AZ'},
		{'name':'Arkansas', 'abbrev':'AR'},
		{'name':'California', 'abbrev':'CA'},
		{'name':'Colorado', 'abbrev':'CO'},
		{'name':'Connecticut', 'abbrev':'CT'},
		{'name':'Delaware', 'abbrev':'DE'},
		{'name':'Florida', 'abbrev':'FL'},
		{'name':'Georgia', 'abbrev':'GA'},
		{'name':'Hawaii', 'abbrev':'HI'},
		{'name':'Idaho', 'abbrev':'ID'},
		{'name':'Illinois', 'abbrev':'IL'},
		{'name':'Indiana', 'abbrev':'IN'},
		{'name':'Iowa', 'abbrev':'IA'},
		{'name':'Kansas', 'abbrev':'KS'},
		{'name':'Kentucky', 'abbrev':'KY'},
		{'name':'Louisiana', 'abbrev':'LA'},
		{'name':'Maine', 'abbrev':'ME'},
		{'name':'Maryland', 'abbrev':'MD'},
		{'name':'Massachusetts', 'abbrev':'MA'},
		{'name':'Michigan', 'abbrev':'MI'},
		{'name':'Minnesota', 'abbrev':'MN'},
		{'name':'Mississippi', 'abbrev':'MS'},
		{'name':'Missouri', 'abbrev':'MO'},
		{'name':'Montana', 'abbrev':'MT'},
		{'name':'Nebraska', 'abbrev':'NE'},
		{'name':'Nevada', 'abbrev':'NV'},
		{'name':'New Hampshire', 'abbrev':'NH'},
		{'name':'New Jersey', 'abbrev':'NJ'},
		{'name':'New Mexico', 'abbrev':'NM'},
		{'name':'New York', 'abbrev':'NY'},
		{'name':'North Carolina', 'abbrev':'NC'},
		{'name':'North Dakota', 'abbrev':'ND'},
		{'name':'Ohio', 'abbrev':'OH'},
		{'name':'Oklahoma', 'abbrev':'OK'},
		{'name':'Oregon', 'abbrev':'OR'},
		{'name':'Pennsylvania', 'abbrev':'PA'},
		{'name':'Rhode Island', 'abbrev':'RI'},
		{'name':'South Carolina', 'abbrev':'SC'},
		{'name':'South Dakota', 'abbrev':'SD'},
		{'name':'Tennessee', 'abbrev':'TN'},
		{'name':'Texas', 'abbrev':'TX'},
		{'name':'Utah', 'abbrev':'UT'},
		{'name':'Vermont', 'abbrev':'VT'},
		{'name':'Virginia', 'abbrev':'VA'},
		{'name':'Washington', 'abbrev':'WA'},
		{'name':'West Virginia', 'abbrev':'WV'},
		{'name':'Wisconsin', 'abbrev':'WI'},
		{'name':'Wyoming', 'abbrev':'WY'},
		{'name':'D.C.', 'abbrev':'DC'},
		{'name':'District of Columbia', 'abbrev':'DC'}
	];
	function convert_state(name, to) {
		var output = false;
		for(var i=states.length-1;i>=0;i--){
			if (to=='name') {
				if (states[i]['abbrev'].toLowerCase() == name.toLowerCase()){
						output = states[i]['name'];
						break;
				}
			}
			else if(to=='abbrev') {
				if (states[i]['name'].toLowerCase() == name.toLowerCase()){
						output = states[i]['abbrev'].toUpperCase();
						break;
				}
			}
		}
		return output;
	}
	function checkState(value,type){
		for(var i=states.length-1;i>=0;i--){
			if(value.toLowerCase()==states[i][type].toLowerCase()){
				return true;
			}
		}
		return false;
	}
	function commaSeparateNumber(x) {
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
	var myInteractive = new Interactive();

	
	function adjustLng(lng, pixelAdjustment, zoom) {
		// pixelAdjustment is how many pixels to the right of the actual center the visual center is
		var pointsPerPixel = 360 / (256 * Math.pow(2, zoom));
		var lngAdjustment = pixelAdjustment * pointsPerPixel; //number of longitudinal points to be shifted
		return lng -= lngAdjustment;
	}

	function retrieveDomain(urlString) {
		var secondSlash = urlString.search('//') + 2;
		var thirdSlash = urlString.substring(secondSlash).search('/');
		if (thirdSlash == -1) {
			return urlString.substring(secondSlash);
		}
		else {
			return urlString.substring(secondSlash).substring(0, thirdSlash);
		}
	}

	function parseYYYYMMDD(input) {
		const [year, month, day] = input.split('-');
		return new Date(year, month - 1, day);
	}

	function parseDate(input) {
		//input: a string, MM/DD/YYYY or MM/DD/YY. returns a date.
		var parts = input.match(/(\d+)/g);
		if (parts !== null && parts.length > 0) {
			var today;
			if (parts.length == 1) { //if month is specified but nothing else
				today = new Date();
				var todayDate = today.getDate();
				var month;
				if (parts[0] <= todayDate) { //date is in same month
					month = today.getMonth() + 1;
				}
				else if (parts[0] > todayDate) { //date is in last month
					month = today.getMonth();
				}
				parts = [month, parts[0], today.getFullYear()];
			}
			else if (parts.length == 2) { //if month and date are specified but not year
				today = new Date();
				var todayMonth = today.getMonth();
				var year;
				if (parts[0] - 1 <= todayMonth) { //same month or less, so this year
					year = today.getFullYear();
				}
				else if (parts[0] - 1 > todayMonth) { //greater than this month, so last year
					year = today.getFullYear() - 1;
				}
				parts.push(year);
			}
			else if (parts[2].length == 2) { //if year is specified but the millenium is not specified
				parts[2] = '20' + parts[2];
			}
			var output = new Date(parts[2], parts[0] - 1, parts[1]);
			if (output == 'Invalid Date') {
				output = new Date(Date.parse(input));
			}
			return output;
		}
		return input;
	}

});

