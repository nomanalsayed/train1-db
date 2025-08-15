<?php
/**
 * Train API Endpoints
 * Handles all train-related REST API endpoints
 */

if (!defined('ABSPATH')) exit;

class BD_Railway_Train_Endpoints {
    private $parent;

    public function __construct($parent) {
        $this->parent = $parent;
    }

    public function register_routes() {
        // List all trains
        register_rest_route($this->parent::API_NAMESPACE, '/trains', [
            'methods' => 'GET',
            'callback' => [$this, 'list_trains'],
            'permission_callback' => '__return_true',
            'args' => [
                'per_page' => ['default' => 50, 'sanitize_callback' => 'absint'],
                'page' => ['default' => 1, 'sanitize_callback' => 'absint'],
                'search' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        // Get single train by ID
        register_rest_route($this->parent::API_NAMESPACE, '/trains/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_train'],
            'permission_callback' => '__return_true',
            'args' => [
                'from' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
                'to' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        // Search trains by route or name/number
        register_rest_route($this->parent::API_NAMESPACE, '/trains/search', [
            'methods' => 'GET',
            'callback' => [$this, 'search_trains'],
            'permission_callback' => '__return_true',
            'args' => [
                'from' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
                'to' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
                'query' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
                'coach' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        // Get train coaches
        register_rest_route($this->parent::API_NAMESPACE, '/trains/(?P<train_id>\d+)/coaches', [
            'methods' => 'GET',
            'callback' => [$this, 'get_train_coaches'],
            'permission_callback' => '__return_true',
        ]);

        // Get specific train coach by code
        register_rest_route($this->parent::API_NAMESPACE, '/trains/(?P<train_id>\d+)/coaches/(?P<coach_code>[a-zA-Z0-9_-]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_train_coach_by_code'],
            'permission_callback' => '__return_true',
        ]);

        // Get train seats (alias for coaches with seat data)
        register_rest_route($this->parent::API_NAMESPACE, '/trains/(?P<train_id>\d+)/seats', [
            'methods' => 'GET',
            'callback' => [$this, 'get_train_seats'],
            'permission_callback' => '__return_true',
            'args' => [
                'from' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
                'to' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
                'coach' => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        // Search trains by route code
        register_rest_route($this->parent::API_NAMESPACE, '/trains/route/(?P<route_code>[a-zA-Z0-9_-]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_train_by_route_code'],
            'permission_callback' => '__return_true',
            'args' => [
                'direction' => ['default' => 'forward', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);
    }

    /**
     * List all trains
     */
    public function list_trains($request) {
        $per_page = intval($request['per_page']);
        $page = intval($request['page']);
        $search = trim($request['search']);

        $args = [
            'post_type' => $this->parent::TRAIN,
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => 'publish',
            'orderby' => 'title',
            'order' => 'ASC',
        ];

        if (!empty($search)) {
            $args['s'] = $search;
        }

        $query = new WP_Query($args);
        $trains = [];

        foreach ($query->posts as $train) {
            $trains[] = $this->format_train_data($train);
        }

        return rest_ensure_response([
            'trains' => $trains,
            'total' => intval($query->found_posts),
            'pages' => intval($query->max_num_pages),
            'page' => $page,
            'per_page' => $per_page,
        ]);
    }

    /**
     * Get single train by ID - ENHANCED TO INCLUDE COMPLETE DATA
     */
    public function get_train($request) {
        $train_id = intval($request['id']);
        $from = trim($request['from'] ?? '');
        $to = trim($request['to'] ?? '');
        
        $train = get_post($train_id);

        if (!$train || $train->post_type !== $this->parent::TRAIN) {
            return new WP_Error('train_not_found', 'Train not found', ['status' => 404]);
        }

        $is_reverse_direction = false;
        $route_code = get_field('code_from_to', $train_id);
        
        if (!empty($from) && !empty($to)) {
            $origin_id = intval(get_field('origin_station', $train_id));
            $dest_id = intval(get_field('destination_station', $train_id));
            $origin_name = $origin_id ? get_the_title($origin_id) : '';
            $dest_name = $dest_id ? get_the_title($dest_id) : '';
            
            if (strcasecmp($from, $dest_name) === 0 && strcasecmp($to, $origin_name) === 0) {
                $is_reverse_direction = true;
                $route_code = get_field('code_to_from', $train_id);
            }
        }

        return rest_ensure_response($this->get_complete_train_data($train, $is_reverse_direction, $route_code));
    }

    /**
     * Search trains by route or name/number - SIMPLIFIED TO AVOID DUPLICATES
     */
    public function search_trains($request) {
        $from = trim($request['from']);
        $to = trim($request['to']);
        $query = trim($request['query']);
        $coach = trim($request['coach']);

        $args = [
            'post_type' => $this->parent::TRAIN,
            'posts_per_page' => 50,
            'post_status' => 'publish',
            'orderby' => 'title',
            'order' => 'ASC',
        ];

        $meta_query = [];

        if (!empty($query)) {
            if (is_numeric($query)) {
                // Search by route code
                $meta_query = [
                    'relation' => 'OR',
                    [
                        'key' => 'code_from_to',
                        'value' => $query,
                        'compare' => '=',
                    ],
                    [
                        'key' => 'code_to_from',
                        'value' => $query,
                        'compare' => '=',
                    ],
                ];
            } else {
                // Search by train name
                $args['s'] = $query;
            }
        }

        if (!empty($meta_query)) {
            $args['meta_query'] = $meta_query;
        }

        $wp_query = new WP_Query($args);
        $trains = [];

        foreach ($wp_query->posts as $train) {
            $code_from_to = get_field('code_from_to', $train->ID);
            $code_to_from = get_field('code_to_from', $train->ID);
            
            if (!empty($code_from_to)) {
                $trains[] = $this->get_complete_train_data($train, false, $code_from_to);
            }
            
            if (!empty($code_to_from) && $code_to_from !== $code_from_to) {
                $trains[] = $this->get_complete_train_data($train, true, $code_to_from);
            }
        }

        return rest_ensure_response([
            'trains' => $trains,
            'total' => count($trains),
            'message' => count($trains) > 0 ? 'Trains found successfully' : 'No trains found. Please try different search criteria.',
        ]);
    }

    /**
     * Get train by route code - SIMPLIFIED AND FIXED
     */
    public function get_train_by_route_code($request) {
        $route_code = trim($request['route_code']);
        $direction = trim($request['direction']);

        if (empty($route_code)) {
            return new WP_Error('missing_route_code', 'Route code is required', ['status' => 400]);
        }

        $trains = get_posts([
            'post_type' => $this->parent::TRAIN,
            'meta_query' => [
                'relation' => 'OR',
                [
                    'key' => 'code_from_to',
                    'value' => $route_code,
                    'compare' => '=',
                ],
                [
                    'key' => 'code_to_from',
                    'value' => $route_code,
                    'compare' => '=',
                ],
            ],
            'posts_per_page' => 1,
            'post_status' => 'publish',
        ]);

        if (empty($trains)) {
            return new WP_Error('train_not_found', 'No train found for this route code', ['status' => 404]);
        }

        $train = $trains[0];
        
        $code_from_to = get_field('code_from_to', $train->ID);
        $code_to_from = get_field('code_to_from', $train->ID);
        $is_reverse_direction = ($route_code === $code_to_from);

        return rest_ensure_response($this->get_complete_train_data($train, $is_reverse_direction, $route_code));
    }

    /**
     * Get complete train data with coaches and seat layouts
     */
    private function get_complete_train_data($train, $is_reverse_direction = false, $route_code = null) {
        $train_id = $train->ID;
        $origin_id = intval(get_field('origin_station', $train_id));
        $dest_id = intval(get_field('destination_station', $train_id));
        $origin_name = $origin_id ? get_the_title($origin_id) : '';
        $dest_name = $dest_id ? get_the_title($dest_id) : '';

        if (!$route_code) {
            $route_code = $is_reverse_direction ? 
                get_field('code_to_from', $train_id) : 
                get_field('code_from_to', $train_id);
        }

        $train_classes = get_field('train_classes', $train_id) ?: [];
        $classes = [];
        $total_coaches = 0;

        foreach ($train_classes as $class_data) {
            $class_id = intval($class_data['class_ref']);
            $class_name = $class_id ? get_the_title($class_id) : '';
            $class_short = $class_id ? get_field('short_code', $class_id) : '';
            $coaches = [];

            if (!empty($class_data['coaches']) && is_array($class_data['coaches'])) {
                foreach ($class_data['coaches'] as $coach_data) {
                    $coach_id = intval($coach_data['coach_ref']);
                    if ($coach_id) {
                        $seat_config = $this->get_seat_layout_for_direction($coach_id, $is_reverse_direction);
                        $coaches[] = [
                            'coach_id' => $coach_id,
                            'coach_code' => get_field('coach_code', $coach_id),
                            'total_seats' => $seat_config['total_seats'],
                            'seat_layout' => $seat_config['seat_layout'],
                            'direction' => $is_reverse_direction ? 'reverse' : 'forward',
                        ];
                        $total_coaches++;
                    }
                }
            }

            if (!empty($coaches)) {
                $classes[] = [
                    'class_id' => $class_id,
                    'class_name' => $class_name,
                    'class_short' => $class_short,
                    'coaches' => $coaches,
                ];
            }
        }

        return [
            'id' => $train_id,
            'name' => get_the_title($train_id),
            'train_name' => get_the_title($train_id),
            'train_number' => $route_code,
            'display_code' => $route_code,
            'number' => $route_code,
            'from_station' => $is_reverse_direction ? $dest_name : $origin_name,
            'to_station' => $is_reverse_direction ? $origin_name : $dest_name,
            'is_reverse_direction' => $is_reverse_direction,
            'direction' => $is_reverse_direction ? 'reverse' : 'forward',
            'route_code' => $route_code,
            'code_from_to' => get_field('code_from_to', $train_id),
            'code_to_from' => get_field('code_to_from', $train_id),
            'classes' => $classes,
            'total_coaches' => $total_coaches,
            '_meta' => [
                'source' => 'wordpress',
                'wordpress_url' => home_url('/wp-json/rail/v1/trains/' . $train_id),
                'classes_count' => count($classes),
                'total_coaches' => $total_coaches,
                'uses_train_number' => true,
            ],
        ];
    }

    /**
     * Format train data for API response
     */
    private function format_train_data($train, $detailed = false) {
        $origin_id = intval(get_field('origin_station', $train->ID));
        $dest_id = intval(get_field('destination_station', $train->ID));

        $train_data = [
            'id' => $train->ID,
            'name' => get_the_title($train->ID),
            'train_name' => get_the_title($train->ID),
            'from_station' => $origin_id ? get_the_title($origin_id) : '',
            'to_station' => $dest_id ? get_the_title($dest_id) : '',
            'code_from_to' => (string) get_field('code_from_to', $train->ID),
            'code_to_from' => (string) get_field('code_to_from', $train->ID),
        ];

        if ($detailed) {
            $routes = get_field('routes', $train->ID) ?: [];
            $train_data['routes'] = $this->format_routes($routes);
            $train_data['train_classes'] = $this->format_train_classes(get_field('train_classes', $train->ID));
        }

        return $train_data;
    }

    /**
     * Format routes data
     */
    private function format_routes($routes) {
        $formatted_routes = [];

        foreach ($routes as $route) {
            $station_id = intval($route['station']);
            if ($station_id) {
                $formatted_routes[] = [
                    'station' => [
                        'id' => $station_id,
                        'name' => get_the_title($station_id),
                        'code' => get_field('station_code', $station_id),
                    ],
                ];
            }
        }

        return $formatted_routes;
    }

    /**
     * Format train classes data
     */
    private function format_train_classes($classes) {
        if (!$classes || !is_array($classes)) return [];

        $formatted_classes = [];

        foreach ($classes as $class_data) {
            $class_id = intval($class_data['class_ref']);
            $coaches = [];

            if (!empty($class_data['coaches']) && is_array($class_data['coaches'])) {
                foreach ($class_data['coaches'] as $coach_data) {
                    $coach_id = intval($coach_data['coach_ref']);
                    if ($coach_id) {
                        $seat_config = $this->parent->calculate_seat_directions($coach_id);
                        $coaches[] = [
                            'coach_id' => $coach_id,
                            'coach_code' => get_field('coach_code', $coach_id),
                            'total_seats' => $seat_config['total_seats'],
                            'front_facing_seats' => $seat_config['front_facing_seats'],
                            'back_facing_seats' => $seat_config['back_facing_seats'],
                        ];
                    }
                }
            }

            $formatted_classes[] = [
                'class_id' => $class_id,
                'class_name' => $class_id ? get_the_title($class_id) : '',
                'class_short' => $class_id ? get_field('short_code', $class_id) : '',
                'coaches' => $coaches,
            ];
        }

        return $formatted_classes;
    }

    /**
     * Get train coaches
     */
    public function get_train_coaches($request) {
        $train_id = $request['train_id'];

        $train = get_post($train_id);
        if (!$train || $train->post_type !== $this->parent::TRAIN) {
            return new WP_Error('train_not_found', 'Train not found', array('status' => 404));
        }

        // Get train classes and extract coaches
        $train_classes = get_field('train_classes', $train_id) ?: [];
        $coaches = array();
        $position = 1;

        foreach ($train_classes as $class_data) {
            $class_id = intval($class_data['class_ref']);
            $class_name = $class_id ? get_the_title($class_id) : '';
            $class_short = $class_id ? get_field('short_code', $class_id) : '';

            if (!empty($class_data['coaches']) && is_array($class_data['coaches'])) {
                foreach ($class_data['coaches'] as $coach_data) {
                    $coach_id = intval($coach_data['coach_ref']);
                    if ($coach_id) {
                        $seat_config = $this->parent->calculate_seat_directions($coach_id);
                        $coaches[] = array(
                            'coach_id' => $coach_id,
                            'coach_code' => get_field('coach_code', $coach_id),
                            'type' => $class_short,
                            'class_name' => $class_name,
                            'total_seats' => $seat_config['total_seats'],
                            'position' => $position,
                            'front_facing_seats' => $seat_config['front_facing_seats'],
                            'back_facing_seats' => $seat_config['back_facing_seats'],
                        );
                        $position++;
                    }
                }
            }
        }

        return array(
            'coaches' => $coaches,
            'train_id' => intval($train_id),
            'train_name' => $train->post_title,
            'train_number' => get_field('train_number', $train_id),
            'count' => count($coaches)
        );
    }

    /**
     * Get specific train coach by code
     */
    public function get_train_coach_by_code($request) {
        $train_id = intval($request['train_id']);
        $coach_code = strtoupper(trim($request['coach_code']));

        $train = get_post($train_id);
        if (!$train || $train->post_type !== $this->parent::TRAIN) {
            return new WP_Error('train_not_found', 'Train not found', ['status' => 404]);
        }

        // Get train classes and find the specific coach
        $train_classes = get_field('train_classes', $train_id) ?: [];
        $position = 1;

        foreach ($train_classes as $class) {
            if (!empty($class['coaches'])) {
                foreach ($class['coaches'] as $coach_data) {
                    $coach_id = $coach_data['coach_id'];
                    $coach = get_post($coach_id);

                    if ($coach && $coach->post_type === $this->parent::COACH) {
                        $stored_coach_code = strtoupper(get_field('coach_code', $coach_id) ?: $coach->post_title);

                        if ($stored_coach_code === $coach_code) {
                            $seat_config = $this->parent->calculate_seat_directions($coach_id);

                            return rest_ensure_response([
                                'id' => $coach_id,
                                'code' => $stored_coach_code,
                                'type' => $class['class_short'] ?? 'UNKNOWN',
                                'total_seats' => $seat_config['total_seats'],
                                'front_facing_seats' => $seat_config['front_facing_seats'],
                                'back_facing_seats' => $seat_config['back_facing_seats'],
                                'front_facing_count' => count($seat_config['front_facing_seats']),
                                'back_facing_count' => count($seat_config['back_facing_seats']),
                                'position' => $position,
                                'train_id' => $train_id,
                                'train_name' => get_the_title($train_id),
                                'train_number' => get_field('train_number', $train_id) ?: strval($train_id),
                            ]);
                        }
                        $position++;
                    }
                }
            }
        }

        return new WP_Error('coach_not_found', 'Coach not found in this train', ['status' => 404]);
    }

    /**
     * Get train seats with route-based direction support
     */
    public function get_train_seats($request) {
        $train_id = intval($request['train_id']);
        $from_station = trim($request['from']);
        $to_station = trim($request['to']);
        $filter_coach = trim($request['coach']);

        $train = get_post($train_id);
        if (!$train || $train->post_type !== $this->parent::TRAIN) {
            return new WP_Error('train_not_found', 'Train not found', array('status' => 404));
        }

        // Get train route information
        $origin_station = get_field('origin_station', $train_id);
        $dest_station = get_field('destination_station', $train_id);
        $origin_name = $origin_station ? get_the_title($origin_station) : '';
        $dest_name = $dest_station ? get_the_title($dest_station) : '';

        // Determine direction based on route
        $is_reverse_direction = false;
        if (!empty($from_station) && !empty($to_station)) {
            // Check if this matches the reverse direction
            if (strcasecmp($from_station, $dest_name) === 0 && strcasecmp($to_station, $origin_name) === 0) {
                $is_reverse_direction = true;
            }
        }

        // Get train classes and extract coaches
        $train_classes = get_field('train_classes', $train_id) ?: [];
        $coaches = array();
        $position = 1;

        foreach ($train_classes as $class_data) {
            $class_id = intval($class_data['class_ref']);
            $class_name = $class_id ? get_the_title($class_id) : '';
            $class_short = $class_id ? get_field('short_code', $class_id) : '';

            if (!empty($class_data['coaches']) && is_array($class_data['coaches'])) {
                foreach ($class_data['coaches'] as $coach_data) {
                    $coach_id = intval($coach_data['coach_ref']);
                    if ($coach_id) {
                        $coach_code = get_field('coach_code', $coach_id);
                        
                        if (!empty($filter_coach) && strcasecmp($coach_code, $filter_coach) !== 0) {
                            continue;
                        }

                        $seat_config = $this->get_seat_layout_for_direction($coach_id, $is_reverse_direction);
                        
                        $coaches[] = array(
                            'coach_id' => $coach_id,
                            'coach_code' => $coach_code,
                            'type' => $class_short,
                            'class_name' => $class_name,
                            'total_seats' => $seat_config['total_seats'],
                            'position' => $position,
                            'seat_layout' => $seat_config['seat_layout'],
                            'direction' => $is_reverse_direction ? 'reverse' : 'forward',
                            'route_code' => $is_reverse_direction ? 
                                get_field('code_to_from', $train_id) : 
                                get_field('code_from_to', $train_id),
                        );
                        $position++;
                    }
                }
            }
        }

        return array(
            'coaches' => $coaches,
            'train_id' => $train_id,
            'train_name' => $train->post_title,
            'train_number' => get_field('train_number', $train_id),
            'direction' => $is_reverse_direction ? 'reverse' : 'forward',
            'route' => array(
                'from' => $is_reverse_direction ? $dest_name : $origin_name,
                'to' => $is_reverse_direction ? $origin_name : $dest_name,
                'code' => $is_reverse_direction ? 
                    get_field('code_to_from', $train_id) : 
                    get_field('code_from_to', $train_id),
            ),
            'count' => count($coaches)
        );
    }

    /**
     * Generate seat layout based on direction (forward vs reverse)
     */
    private function get_seat_layout_for_direction($coach_id, $is_reverse = false) {
        $total_seats = intval(get_field('total_seats', $coach_id)) ?: 100;
        $front_start = intval(get_field('front_facing_start', $coach_id)) ?: 1;
        $front_end = intval(get_field('front_facing_end', $coach_id)) ?: 50;
        
        $layout = array();
        $seats_per_row = 5; // 2 + 3 configuration
        $total_rows = ceil($total_seats / $seats_per_row);
        
        for ($row = 0; $row < $total_rows; $row++) {
            $row_seats = array();
            
            // Left side: 2 seats
            for ($col = 0; $col < 2; $col++) {
                $seat_num = ($row * $seats_per_row) + $col + 1;
                if ($seat_num <= $total_seats) {
                    $is_front_facing = ($seat_num >= $front_start && $seat_num <= $front_end);
                    
                    if ($is_reverse) {
                        $is_front_facing = !$is_front_facing;
                    }
                    
                    $row_seats[] = array(
                        'number' => $seat_num,
                        'type' => $is_front_facing ? 'front_facing' : 'back_facing',
                        'color' => $is_front_facing ? 'blue' : 'gray',
                        'position' => 'left'
                    );
                }
            }
            
            // Right side: 3 seats
            for ($col = 2; $col < 5; $col++) {
                $seat_num = ($row * $seats_per_row) + $col + 1;
                if ($seat_num <= $total_seats) {
                    $is_front_facing = ($seat_num >= $front_start && $seat_num <= $front_end);
                    
                    if ($is_reverse) {
                        $is_front_facing = !$is_front_facing;
                    }
                    
                    $row_seats[] = array(
                        'number' => $seat_num,
                        'type' => $is_front_facing ? 'front_facing' : 'back_facing',
                        'color' => $is_front_facing ? 'blue' : 'gray',
                        'position' => 'right'
                    );
                }
            }
            
            if (!empty($row_seats)) {
                $layout[] = $row_seats;
            }
        }

        return array(
            'total_seats' => $total_seats,
            'seat_layout' => $layout
        );
    }

    /**
     * Find station by name or code
     */
    private function find_station_by_name_or_code($search_term) {
        // Try by exact title match first
        $station = get_page_by_title($search_term, OBJECT, $this->parent::STATION);
        if ($station) {
            return $station->ID;
        }

        // Try by station code
        $stations = get_posts([
            'post_type' => $this->parent::STATION,
            'meta_query' => [
                [
                    'key' => 'station_code',
                    'value' => $search_term,
                    'compare' => '=',
                ],
            ],
            'posts_per_page' => 1,
            'fields' => 'ids',
        ]);

        return !empty($stations) ? intval($stations[0]) : 0;
    }

    // Helper method to check if train has specific coach
    private function train_has_coach($train_id, $coach) {
        if (empty($coach)) {
            return true; // No coach filter, so all trains match
        }
        
        $train_classes = get_field('train_classes', $train_id) ?: [];
        
        foreach ($train_classes as $class_data) {
            if (!empty($class_data['coaches']) && is_array($class_data['coaches'])) {
                foreach ($class_data['coaches'] as $coach_data) {
                    $coach_id = intval($coach_data['coach_ref']);
                    if ($coach_id) {
                        $coach_code = get_field('coach_code', $coach_id);
                        if (strcasecmp($coach_code, $coach) === 0) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
}
